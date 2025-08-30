# AstaVerde v2 — Security & Functional Updates (QA Guide)

Date: 2025-08-27
Status: Ready for QA on Base Sepolia

This message summarizes the concrete security fixes and functional improvements in AstaVerde v2 and provides clear QA steps. It reflects the current codebase and tests in this repository.

—

## Executive Summary

We addressed seven security/operational risks in v1 and added safeguards and UX improvements:

- Refunds now come from the user’s own transfer (no reserve leakage)
- Producer payments use pull-claims (no DoS from smart-wallet producers)
- Old batches no longer revert at deep decay; prices clamp to floor
- Price updates are gas-bounded by an iteration limit and 90‑day lookback
- ERC20 transfers use SafeERC20 throughout
- External ERC1155 deposits back to the contract are rejected
- Admin safety: 50% platform fee cap, surplus USDC recovery, pricing invariants

The contract is ready for QA on Base Sepolia. Provide the deployed addresses below (or deploy via the included scripts) and follow the test scenarios.

—

## Sepolia QA Environment

- Network: Base Sepolia (chainId 84532)
- Webapp: Local option via `npm run dev:sepolia` (runs on port 3002)
- Required addresses (fill in after deployment):
  - AstaVerde: <TBD>
  - EcoStabilizer: <TBD>
  - SCC (StabilizedCarbonCoin): <TBD>
  - USDC (6 decimals): <TBD>

Notes:
- On Base mainnet, AstaVerde enforces the canonical USDC address. On testnets, only `decimals()==6` is enforced.
- The repository includes `npm run deploy:testnet` and `scripts/dev-sepolia.js` to assist setup.

—

## Security Improvements Requiring QA

1) Refund Handling Vulnerability — FIXED
- What changed: `buyBatch` pulls the full declared `usdcAmount` from the buyer, then refunds any excess from the same funds before transferring NFTs. Platform and producer balances are never used to fund refunds.
- How to test:
  - Over-approve and over-send (e.g., approve/send 1000 USDC for a 100 USDC purchase). Expect an automatic refund of 900 USDC; platform + producer accounting should equal the actual sale amount.
  - Under-approve while sending a larger `usdcAmount` (e.g., approve 100 USDC but pass `usdcAmount=1000`). Expect a revert due to insufficient allowance (error wording may vary by token implementation).

2) Producer Payment Disruption — FIXED
- What changed: Producer funds accrue in `producerBalances` and are claimed via `claimProducerFunds()`; purchases never depend on producer wallet behavior.
- How to test:
  - Buy across multiple producers; verify each producer’s balance via webapp `/producer` or `getProducerBalance(address)`.
  - Claim as each producer; balances reset individually; other producers unaffected.

3) Old-Batch Arithmetic Reverts — FIXED
- What changed: `getCurrentBatchPrice()` clamps to `priceFloor` when daily decay would underflow the starting price.
- How to test:
  - Local: advance time 200+ days and assert floor price; purchase succeeds.
  - On Sepolia, this behavior is covered by unit tests; deep backdating isn’t feasible on live testnets.

4) Gas Cost Scalability — FIXED
- What changed: `updateBasePrice()` processes at most `maxPriceUpdateIterations` batches (default 100) and emits `PriceUpdateIterationLimitReached` when capped. A 90‑day lookback window prevents ancient batches from impacting pricing.
- How to test:
  - Lower `maxPriceUpdateIterations` for demonstration, mint many batches, and perform a transaction that triggers a price update; observe the event emission and stable gas.

5) USDC Token Configuration Safety — IMPROVED
- What changed: Constructor validates the token is a contract with `decimals()==6`; on Base mainnet, enforces canonical USDC address.
- How to test:
  - Confirm UI shows 6‑decimal amounts, purchases/claims reconcile to USDC base units.

6) Safer ERC20 Interactions — IMPROVED
- What changed: All USDC transfers use OpenZeppelin SafeERC20 to support non‑standard tokens and clearer failures.
- How to test:
  - Exercise purchase, platform-fee claim, and producer claims; failed transfers (e.g., insufficient balance/allowance) revert clearly.

7) External ERC1155 Deposit Prevention — FIXED
- What changed: ERC1155 receiver hooks accept only self‑originated mints/self‑transfers; user “returns” to the marketplace are rejected.
- How to test:
  - Attempt to send an AstaVerde NFT from a user back to the contract; expect revert. (Message may be “No external returns”.)

—

## Functional Improvements

- Platform Fee Cap: Admin cannot set fees above 50%.
- Surplus USDC Recovery: Owner can sweep only balances above platform + producer accounting (accidental direct transfers), leaving owed funds intact.
- Price Algorithm Refinements: 90‑day lookback; quick sales (<2 days) add +10 USDC to base price; extended stagnation (≥4 days since last complete sale) decrements base price, never below floor.
- Additional Safeguards: `basePrice >= priceFloor` enforced by setters; CID length capped at 100 chars; `isRedeemed(tokenId)` view for stable integrations.

—

## Breaking Changes vs v1 (QA Focus)

- Producer payments are claimed, not auto‑transferred. Use `/producer` to claim.
- Direct USDC transfers to the contract do not count as purchases; only `buyBatch()` does. Excess direct transfers are recoverable only via `recoverSurplusUSDC()` by the owner.
- External ERC1155 deposits back to the marketplace are blocked; user trades between wallets continue to work normally.

—

## Test Scenarios (Priority Order)

1) Producer Payment System
- Buy NFTs from multiple batches/producers; verify accrual per producer and isolated claims.
- Claim funds as each producer using the dashboard.

2) Security Validations
- Overpayment refund behavior and under‑approval revert.
- Old‑batch price clamp (local time‑advance) or review unit test evidence.
- Gas stability with many batches and iteration‑limit event visibility.
- Attempt external NFT returns to the contract (expect revert).

3) Price Mechanics
- Create/sell batches and confirm +10 USDC increases for quick sales and decreases after prolonged stagnation, bounded by floor.

4) Admin Controls
- Set platform fee within [0, 50]; >50 should revert.
- Adjust base price/floor while preserving `basePrice >= priceFloor`.
- Adjust iteration cap; observe effect on gas and event emissions.
- Pause/unpause and verify recovery functions that are allowed during pause (e.g., platform funds, surplus USDC) behave correctly.

—

## What to Monitor

- Gas: Purchases should remain reasonable even with price updates; if `PriceUpdateIterationLimitReached` appears frequently, consider raising the cap (tradeoff vs buyer gas).
- Events: `PriceUpdateIterationLimitReached`, `BasePriceAdjusted`, producer payment events, platform claims, surplus recovery.
- Accounting: `platformShareAccumulated + totalProducerBalances` should equal the accounted portion of USDC held by the contract.

—

## Deployment & Security Notes

- USDC address is immutable after deployment; on Base mainnet, it must be canonical USDC.
- Owner should be a multisig in production; payment functions are `nonReentrant`.
- Emergency pause is available; certain recovery operations remain available while paused.

—

## Appendix: Quick QA Checklist

Security ✓
- [ ] Overpayment refund returns exact difference
- [ ] Under‑approval reverts on insufficient allowance
- [ ] Producer accrual and claims are isolated and accurate
- [ ] Old batch price returns floor (local test or unit-test evidence)
- [ ] Iteration cap keeps price updates bounded; event observed as appropriate
- [ ] External ERC1155 returns are rejected

Functional ✓
- [ ] Normal purchase flow
- [ ] Price increases on quick sales; decreases on stagnation (not below floor)
- [ ] Platform fee adjustments (0–50%)
- [ ] Surplus USDC recovery (only surplus)

Integration ✓
- [ ] Webapp purchase flow
- [ ] Producer dashboard shows balance and claims succeed
- [ ] Event monitoring surfaces key adjustments and claims
- [ ] Multi-user interactions reflect correct accounting and ownership

—

Questions or need hosted QA access? We can supply deployed Sepolia addresses and a hosted webapp URL, or you can run the local QA environment with the scripts provided in this repository.

