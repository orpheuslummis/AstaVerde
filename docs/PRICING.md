# AstaVerde v1 — Pricing Mechanics

Last updated: 2025-09-13

Scope: documents the ERC‑1155 Dutch‑auction pricing for the Phase 1 marketplace (`contracts/AstaVerde.sol`), its long‑term behavior, operational guardrails, known caveats, and test coverage. The Phase 2 vault (EcoStabilizer/SCC) is out of scope except where noted.

## Summary

- Per‑batch Dutch auction with daily linear decay to a floor; price is independent per batch and time‑based.
- A global `basePrice` feeds new batches; it auto‑adjusts up on quick sell‑outs and down when inventory sits unsold.
- Adjustments are conservative by design (bounded iterations, time windows) to contain gas and avoid instability.

## Key Parameters (defaults)

- `basePrice`: 230 USDC (applies at mint time per batch).
- `priceFloor`: 40 USDC (absolute floor for any batch).
- `dailyPriceDecay`: 1 USDC/day per batch.
- `priceAdjustDelta`: 10 USDC (tick up/down applied to `basePrice`).
- `dayIncreaseThreshold`: 2 days (quick sell‑out window).
- `dayDecreaseThreshold`: 4 days (no complete sales window).
- `PRICE_WINDOW`: 90 days (ignore very old batches in adjustments).
- `maxPriceUpdateIterations`: 100 (DoS bound for decrease scan).

Constants live in `contracts/AstaVerde.sol`; values are owner‑tunable where appropriate.

## Batch Price Decay (per batch)

Function: `getCurrentBatchPrice(batchID)`

- `startingPrice` is captured from `basePrice` at `mintBatch()` time.
- Current price = `startingPrice − dailyPriceDecay × daysSinceCreation`, floored at `priceFloor`.
- On full sell‑out, `batchFinalPrice[batchID]` is recorded and returned thereafter.
- Underflow is handled explicitly; after enough days, price clamps at the floor.

Implications:

- Existing batches are immune to later `basePrice` changes; only new mints see the updated base.
- Identical batches minted at different times naturally diverge due to time‑based decay.

## Base Price Auto‑Adjustment (global)

Function: `updateBasePrice()` (invoked by `mintBatch()` and `buyBatch()`)

1. Price increases (quick sell‑outs)

- Looks at up to the 10 most recent batches whose `creationTime` is within `PRICE_WINDOW`.
- For each batch that sold out after the last adjustment and within `< dayIncreaseThreshold` days of its creation, increments a `quickSaleCount`.
- If `quickSaleCount > 0`, increases `basePrice` by `quickSaleCount × priceAdjustDelta`, updates `lastPriceAdjustmentTime`, emits `BasePriceAdjusted(..., increased=true)`, then returns early (no decrease considered in the same call).

2. Price decreases (stagnation)

- Only evaluated when there have been no complete sell‑outs for `≥ dayDecreaseThreshold` days (`lastCompleteSaleTime`).
- Scans batches backward (bounded by `maxPriceUpdateIterations` and `PRICE_WINDOW`).
- Counts batches that are fully unsold (no token ever sold) and not previously counted (`batchUsedInPriceDecrease==false`) with `creationTime ≤ currentTime − dayDecreaseThreshold × 1d`.
- Decreases `basePrice` by `unsoldBatchCount × priceAdjustDelta`, not below `priceFloor`. Marks processed batches and emits events. Emits `PriceUpdateIterationLimitReached` if capped.

Design goals: keep gas bounded, avoid over‑reacting to noisy sales, and prefer eventual consistency for downwards moves.

## Long‑Term Behaviors & Caveats

- Partial‑sale suppression: A batch only counts toward decreases if zero tokens sold. Buying a single token (especially near the decayed price) from many batches can indefinitely suppress decreases.
- “No complete sales” gate: Any full sell‑out within the last `dayDecreaseThreshold` days blocks decreases for that tick, even if most inventory is stagnant.
- 90‑day window: Very old unsold inventory (>90 days) is ignored in decreases; `basePrice` may remain elevated during long stagnations with aged stock.
- Increase sampling bias: Increases consider only the last 10 minted batches (within the window). Quick sell‑outs just outside that set don’t contribute until they enter the sampled tail of mint history.
- Short‑circuiting: If any increases are found, the function returns early and does not attempt decreases in the same call. Upward moves can apply sooner than downward moves.
- Eventual consistency: With many eligible unsold batches and a low `maxPriceUpdateIterations`, decreases step down across multiple calls.

These behaviors are intentional guardrails for gas and stability, but they do mean `basePrice` is “sticky” upwards and conservative downwards across long horizons.

## Operational Guidance

- Monitoring
    - Watch `BasePriceAdjusted`, `PriceUpdateIterationLimitReached`, and `BatchMarkedUsedInPriceDecrease` to understand drift and backlog.
    - Track the share of active batches at floor; a high fraction for multiple days indicates suppressed decreases.

- Tuning
    - `maxPriceUpdateIterations`: 60–100 in normal conditions (buyers pay gas in `buyBatch`), 50–60 in high activity to reduce buyer costs.
    - `dayIncreaseThreshold` and `dayDecreaseThreshold`: widen to reduce churn; narrow to react faster (with higher gas across events).
    - Consider operationally preferring larger `mintBatch` sizes (up to `maxBatchSize`) to reduce total batch count and scan work.

## Test Coverage Snapshot

Covered in `test/AstaVerde.test.ts` and `test/AstaVerdeCoverageGaps.test.ts`:

- Daily decay to floor across long horizons; floor clamping.
- No base‑price increase on partial sales; increase on quick full sell‑outs.
- Decrease after `dayDecreaseThreshold`; cannot drop below `priceFloor`.
- Iteration‑limit event and bounded gas behavior.

Recommended additions (gaps):

- Partial‑sale suppression scenario: mint N batches, buy 1 token from each within 4 days, advance time beyond threshold; assert no decrease occurs.
- 90‑day window: leave unsold batches >90 days old; assert they don’t affect decreases.
- Increase sampling window: mint >10 batches; quick sell‑out batches just outside the last‑10; assert no increase until a “last‑10” batch qualifies.
- Mixed signals in one tick: arrange both quick sell‑outs and multiple unsold‑matured batches; assert increase occurs and decreases are skipped for the call.

## Potential Improvements (optional, backwards‑compatible by default)

If the above stickiness is acceptable, keep as‑is and document. If you want `basePrice` to more closely track demand while preserving gas bounds, consider:

- Sell‑through‑based decreases: count batches with low sell‑through (e.g., ≤10–20% sold) after the threshold, not only fully unsold. This reduces the “single token” suppression vector.
- Dual‑sided netting per call: under one iteration budget, compute both quick‑sell increases and unsold decreases, then apply the signed net delta once to avoid bias.
- Broader increase sampling: look at “most recent sold‑out” batches within `PRICE_WINDOW` rather than only “last 10 minted”.
- Floor‑saturation fallback: if ≥X% of active batches sit at `priceFloor` for ≥Y days, apply a one‑off down tick even if a recent sell‑out occurred.

All of the above can be added behind owner‑settable knobs with conservative defaults to maintain current behavior unless deliberately enabled.

## FAQ

Q: Do existing batches change price when `basePrice` changes?

A: No. A batch’s `startingPrice` is locked at mint; only new batches see the new `basePrice`.

Q: Why can downward moves lag?

A: Decreases are gated by “no complete sales for ≥ threshold”, ignore partial‑sold batches, respect a 90‑day window, and are iteration‑bounded. All four are designed to cap gas and avoid over‑corrections.

Q: How do we know if bounded iterations are slowing adjustments?

A: Look for repeated `PriceUpdateIterationLimitReached` events; consider temporarily lifting `maxPriceUpdateIterations` during off‑peak or shifting adjustment triggers to owner‑paid `mintBatch` operations.

---

For implementation references, see `contracts/AstaVerde.sol`:

- `getCurrentBatchPrice`, `mintBatch`, `buyBatch` (pricing + lifecycle)
- `updateBasePrice` (auto‑adjustment), `PRICE_WINDOW`, `maxPriceUpdateIterations`
- Events: `BasePriceAdjusted`, `PriceUpdateIterationLimitReached`, `BatchMarkedUsedInPriceDecrease`
