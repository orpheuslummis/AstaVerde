#!/usr/bin/env python3
"""
Minimal crypto‑economic simulator for the EcoStabilizer system.

- Pure Python 3.12, no external deps. Runnable with uvx:

  uvx python scripts/sim_vault.py --scenario healthy --days 180 --seed 42

- Scenarios emulate:
  - Primary market price path (new EcoAsset price)
  - Arbitrage when SCC > primary_price/20 (with spread threshold)
  - User withdrawals when 20*SCC < perceived NFT value
  - Basic SCC market impact from net buy/sell flow

This is an intentionally compact, parameterized model for directional analysis,
not a prediction tool. Keep parameters modest, and compare across scenarios.
"""

from __future__ import annotations

import argparse
import math
import random
from dataclasses import dataclass
from typing import Callable, List


@dataclass
class SimulationConfig:
    days: int = 180
    seed: int | None = None

    # Primary market (EcoAsset) dynamics
    initial_primary_price_usdc: float = 230.0
    primary_price_floor_usdc: float = 40.0
    primary_daily_drift_usdc: float = 0.0
    primary_daily_vol_usdc: float = 2.0
    primary_supply_per_day: int = 50  # new NFTs available per day

    # SCC market
    initial_scc_price_usdc: float = 10.0
    scc_daily_vol_pct: float = 0.03  # exogenous day-to-day pct move (stddev)
    scc_market_depth_scc: float = 50_000.0  # rough depth for linear impact
    scc_impact_coefficient: float = 1.0  # linear price impact scale

    # Vault / mechanism
    scc_per_asset: float = 20.0
    arbitrage_spread_threshold_pct: float = 0.01  # require >1% gap over ceiling
    arbitrage_capacity_assets_per_day: int = 200
    withdrawal_sensitivity: float = 0.15  # responsiveness to value gap
    withdrawal_max_rate_pct_per_day: float = 0.10  # cap as fraction of active loans

    # Defaults for scenario overrides
    scenario: str = "healthy"


@dataclass
class SimulationState:
    day: int = 0
    primary_price_usdc: float = 0.0
    scc_price_usdc: float = 0.0

    active_loans: int = 0
    total_deposits: int = 0
    total_withdrawals: int = 0

    total_scc_minted: float = 0.0
    total_scc_burned: float = 0.0

    # Tracking
    arbitrage_days: int = 0
    max_premium_over_ceiling_pct: float = 0.0

    def scc_circulating(self) -> float:
        return self.total_scc_minted - self.total_scc_burned

    def scc_liability(self, cfg: SimulationConfig) -> float:
        return cfg.scc_per_asset * float(self.active_loans)

    def supply_gap(self, cfg: SimulationConfig) -> float:
        # Positive if more SCC in circulation than outstanding loan liability
        return self.scc_circulating() - self.scc_liability(cfg)


def clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def build_primary_series(cfg: SimulationConfig) -> Callable[[int, float], float]:
    """
    Returns a function f(day, prev_price)->price that generates a primary price series
    with optional scenario overrides.
    """

    scenario = cfg.scenario.lower()

    if scenario == "healthy":
        # Mild noise around stable mean; occasional positive drift
        def f(day: int, prev: float) -> float:
            drift = cfg.primary_daily_drift_usdc or 0.02
            shock = random.gauss(0.0, cfg.primary_daily_vol_usdc)
            price = max(cfg.primary_price_floor_usdc, prev + drift + shock)
            return price

        return f

    if scenario == "halt_primary":
        # Price decays toward floor and stays near it (supply exists but weak demand)
        def f(day: int, prev: float) -> float:
            decay = -2.0  # 2 USDC/day down until floor
            shock = random.gauss(0.0, 1.0)
            price = max(cfg.primary_price_floor_usdc, prev + decay + shock)
            return price

        return f

    if scenario == "shock":
        # Healthy for 1/3, negative shock (−40%), slow recovery
        shock_day = max(2, cfg.days // 3)

        def f(day: int, prev: float) -> float:
            if day == shock_day:
                return max(cfg.primary_price_floor_usdc, prev * 0.6)
            drift = 0.05 if day < shock_day else 0.03  # small positive drift
            vol = cfg.primary_daily_vol_usdc * (1.0 if day < shock_day else 1.5)
            price = max(cfg.primary_price_floor_usdc, prev + drift + random.gauss(0.0, vol))
            return price

        return f

    if scenario == "bull":
        def f(day: int, prev: float) -> float:
            drift = 0.5
            shock = random.gauss(0.0, 2.0)
            return max(cfg.primary_price_floor_usdc, prev + drift + shock)

        return f

    if scenario == "bear":
        def f(day: int, prev: float) -> float:
            drift = -0.5
            shock = random.gauss(0.0, 2.0)
            return max(cfg.primary_price_floor_usdc, prev + drift + shock)

        return f

    # default
    def f(day: int, prev: float) -> float:
        return max(cfg.primary_price_floor_usdc, prev + (cfg.primary_daily_drift_usdc or 0.0) + random.gauss(0.0, cfg.primary_daily_vol_usdc))

    return f


def apply_linear_price_impact(
    price_usdc: float,
    net_flow_scc: float,
    depth_scc: float,
    impact_coeff: float,
) -> float:
    """
    Linearized price impact: dP/P ≈ impact_coeff * (net_flow / depth)
    net_flow_scc > 0 → net buy pressure (price up), < 0 → sell pressure.
    """
    if depth_scc <= 0:
        return price_usdc
    pct_change = impact_coeff * (net_flow_scc / depth_scc)
    # Keep changes reasonable
    pct_change = clamp(pct_change, -0.3, 0.3)
    return max(0.01, price_usdc * (1.0 + pct_change))


def run_simulation(cfg: SimulationConfig) -> tuple[SimulationConfig, SimulationState, List[dict[str, float]]]:
    if cfg.seed is not None:
        random.seed(cfg.seed)

    primary_fn = build_primary_series(cfg)

    st = SimulationState(
        day=0,
        primary_price_usdc=cfg.initial_primary_price_usdc,
        scc_price_usdc=cfg.initial_scc_price_usdc,
    )

    rows: List[dict[str, float]] = []

    for d in range(1, cfg.days + 1):
        st.day = d

        # 1) Primary market price update
        st.primary_price_usdc = primary_fn(d, st.primary_price_usdc)

        # 2) Exogenous SCC move (random walk)
        exo_move = random.gauss(0.0, cfg.scc_daily_vol_pct)
        st.scc_price_usdc = max(0.01, st.scc_price_usdc * (1.0 + exo_move))

        # 3) Arbitrage ceiling check
        ceiling = st.primary_price_usdc / cfg.scc_per_asset
        premium = st.scc_price_usdc / ceiling - 1.0 if ceiling > 0 else 0.0
        premium_over_ceiling_pct = 100.0 * premium if premium > 0 else 0.0
        st.max_premium_over_ceiling_pct = max(st.max_premium_over_ceiling_pct, premium_over_ceiling_pct)

        arbitrage_assets = 0
        net_flow_scc = 0.0  # positive = buy SCC, negative = sell SCC

        if premium > cfg.arbitrage_spread_threshold_pct:
            st.arbitrage_days += 1
            # Limit by capacity and primary supply
            arbitrage_assets = min(cfg.arbitrage_capacity_assets_per_day, cfg.primary_supply_per_day)
            minted = cfg.scc_per_asset * arbitrage_assets
            st.total_deposits += arbitrage_assets
            st.active_loans += arbitrage_assets
            st.total_scc_minted += minted
            # Arbitrageurs sell SCC into market
            net_flow_scc -= minted

        # 4) Withdrawals: more likely when NFT value > 20*SCC (cheap SCC)
        value_ratio = (st.primary_price_usdc / (cfg.scc_per_asset * st.scc_price_usdc)) if st.scc_price_usdc > 0 else 0.0
        # target withdrawal rate ~ sensitivity * max(0, value_ratio - 1)
        target_rate = cfg.withdrawal_sensitivity * max(0.0, value_ratio - 1.0)
        max_rate = cfg.withdrawal_max_rate_pct_per_day
        realized_rate = clamp(target_rate, 0.0, max_rate)
        potential_withdrawals = math.floor(st.active_loans * realized_rate)

        # Bounded by available SCC market buying power; model as soft limit via price impact
        withdrawals = min(potential_withdrawals, st.active_loans)
        if withdrawals > 0:
            burned = cfg.scc_per_asset * withdrawals
            st.total_withdrawals += withdrawals
            st.active_loans -= withdrawals
            st.total_scc_burned += burned
            # Users buy SCC to burn → net buy flow
            net_flow_scc += burned

        # 5) Apply net flow price impact
        st.scc_price_usdc = apply_linear_price_impact(
            st.scc_price_usdc, net_flow_scc, cfg.scc_market_depth_scc, cfg.scc_impact_coefficient
        )

        # 6) Record row
        rows.append(
            {
                "day": float(d),
                "primary_price": st.primary_price_usdc,
                "scc_price": st.scc_price_usdc,
                "ceiling": ceiling,
                "premium_over_ceiling_pct": premium_over_ceiling_pct,
                "active_loans": float(st.active_loans),
                "deposits_today": float(arbitrage_assets),
                "withdrawals_today": float(withdrawals),
                "scc_circulating": st.scc_circulating(),
                "scc_liability": st.scc_liability(cfg),
                "scc_supply_gap": st.supply_gap(cfg),
                "net_flow_scc": net_flow_scc,
            }
        )

    return cfg, st, rows


def print_summary(cfg: SimulationConfig, st: SimulationState, rows: List[dict[str, float]]) -> None:
    last = rows[-1]
    avg_premium = sum(r["premium_over_ceiling_pct"] for r in rows) / len(rows)

    print("\nSimulation Summary")
    print("===================")
    print(f"Scenario:                 {cfg.scenario}")
    print(f"Days:                     {cfg.days}")
    print(f"Final Primary Price:      {last['primary_price']:.2f} USDC")
    print(f"Final SCC Price:          {last['scc_price']:.2f} USDC")
    print(f"Final Ceiling:            {last['ceiling']:.2f} USDC (primary/20)")
    print(f"Arbitrage Days:           {st.arbitrage_days}")
    print(f"Max Premium Over Ceiling: {st.max_premium_over_ceiling_pct:.2f}%")
    print(f"Avg Premium Over Ceiling: {avg_premium:.2f}%")
    print(f"Active Loans (final):     {int(last['active_loans'])}")
    print(f"Total Deposits:           {st.total_deposits}")
    print(f"Total Withdrawals:        {st.total_withdrawals}")
    print(f"SCC Circulating:          {last['scc_circulating']:.2f}")
    print(f"SCC Liability (20*loans): {last['scc_liability']:.2f}")
    print(f"Supply Gap (circ-liab):   {last['scc_supply_gap']:.2f}")


def maybe_print_csv(rows: List[dict[str, float]], show_csv: bool) -> None:
    if not show_csv:
        return
    headers = list(rows[0].keys())
    print("\nCSV (day-level)")
    print(",".join(headers))
    for r in rows:
        print(",".join(str(r[h]) for h in headers))


def parse_args() -> SimulationConfig:
    p = argparse.ArgumentParser(description="EcoStabilizer crypto-economic simulator (stdlib only)")
    p.add_argument("--scenario", default="healthy", choices=["healthy", "halt_primary", "shock", "bull", "bear"], help="Scenario preset")
    p.add_argument("--days", type=int, default=180)
    p.add_argument("--seed", type=int, default=None)
    p.add_argument("--show-csv", action="store_true", help="Print day-level CSV after summary")

    # Optional tunables
    p.add_argument("--initial-primary", type=float, default=None, help="Initial primary price (USDC)")
    p.add_argument("--primary-floor", type=float, default=None, help="Primary market price floor (USDC)")
    p.add_argument("--initial-scc", type=float, default=None, help="Initial SCC price (USDC)")
    p.add_argument("--arbitrage-capacity", type=int, default=None, help="Max arbitrage assets/day")
    p.add_argument("--primary-supply", type=int, default=None, help="New NFTs per day")
    p.add_argument("--withdraw-sensitivity", type=float, default=None, help="Withdrawal responsiveness (0..1)")
    p.add_argument("--withdraw-max-rate", type=float, default=None, help="Max withdraw fraction/day (0..1)")
    p.add_argument("--market-depth", type=float, default=None, help="SCC market depth (SCC units)")
    p.add_argument("--impact", type=float, default=None, help="Linear impact coefficient")

    a = p.parse_args()
    cfg = SimulationConfig(days=a.days, seed=a.seed, scenario=a.scenario)

    if a.initial_primary is not None:
        cfg.initial_primary_price_usdc = a.initial_primary
    if a.primary_floor is not None:
        cfg.primary_price_floor_usdc = a.primary_floor
    if a.initial_scc is not None:
        cfg.initial_scc_price_usdc = a.initial_scc
    if a.arbitrage_capacity is not None:
        cfg.arbitrage_capacity_assets_per_day = a.arbitrage_capacity
    if a.primary_supply is not None:
        cfg.primary_supply_per_day = a.primary_supply
    if a.withdraw_sensitivity is not None:
        cfg.withdrawal_sensitivity = a.withdraw_sensitivity
    if a.withdraw_max_rate is not None:
        cfg.withdrawal_max_rate_pct_per_day = a.withdraw_max_rate
    if a.market_depth is not None:
        cfg.scc_market_depth_scc = a.market_depth
    if a.impact is not None:
        cfg.scc_impact_coefficient = a.impact

    # Basic sanity clamps
    cfg.withdrawal_sensitivity = clamp(cfg.withdrawal_sensitivity, 0.0, 1.0)
    cfg.withdrawal_max_rate_pct_per_day = clamp(cfg.withdrawal_max_rate_pct_per_day, 0.0, 1.0)

    return cfg


def main() -> None:
    cfg = parse_args()
    cfg, st, rows = run_simulation(cfg)
    print_summary(cfg, st, rows)
    # Only print CSV if requested to keep output concise by default
    maybe_print_csv(rows, show_csv=False)  # default off; use --show-csv if desired


if __name__ == "__main__":
    main()


