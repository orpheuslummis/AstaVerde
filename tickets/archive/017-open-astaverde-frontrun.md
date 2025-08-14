# Ticket: Prevent Front-Running of Price Adjustments

Status: Completed

- Component: `contracts/AstaVerde.sol`
- Severity: Low-Medium
- Type: MEV/Fairness Issue

## Background / Justification

`updateBasePrice()` timing differs per function:

- In `mintBatch`, `updateBasePrice()` is already called before minting the new batch (line ~181), which is correct.
- In `buyBatch`, `updateBasePrice()` is called after state mutations for the current batch (line ~265). This allows a narrow window where a mempool observer can front-run a purchase that would trigger a future price increase, by buying at the old base price just before the adjustment.

The update only affects future batches (not the current purchase), so this is a fairness issue, not a direct loss vector.

## Impact

- Limited MEV/time-arbitrage opportunity around future-batch pricing
- No direct value extraction from the current purchase
- Cleaner ordering improves predictability and reasoning

## Tasks

1. In `buyBatch`, compute `currentPrice` before any updates, then call `updateBasePrice()` before performing external token transfers. Ensure the price charged for the current purchase remains the pre-update `currentPrice`.
2. Keep `mintBatch` as-is (already updates before creating the batch).
3. Add a brief comment documenting the intended ordering.

## Alternative Approaches

- Introduce a short cool-down or TWAP for base price updates.
- Add a per-call `deadline` and `maxPrice` (covered separately by the slippage ticket).

## Acceptance Criteria

- `buyBatch` calls `updateBasePrice()` earlier in the flow without changing the price used for the current purchase.
- No behavior change for `mintBatch`.
- Tests cover ordering and ensure price used for the current call is the pre-update value.

Implementation notes:

- `contracts/AstaVerde.sol`: Added an ordering comment and ensured `updateBasePrice()` is invoked immediately after locking `currentPrice` and recording sale state, and before any external transfers.
- `test/SecurityRegressions.ts`: Added a test "Price Adjustment Front-Running Prevention" validating that the buyer is charged the pre-update price and that the `basePrice` increases for subsequent batches.

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts`

## Test Plan

- Simulate a transaction that would cause a price increase and ensure the current purchase uses the pre-update price while the base price is updated for subsequent batches.
