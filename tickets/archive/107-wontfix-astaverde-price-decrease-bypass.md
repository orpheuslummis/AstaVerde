# Ticket #107: CRITICAL - AstaVerde Price Decrease Bypass via Single Token Purchase

## Priority: CRITICAL (Phase 1 acknowledged behavior)

## Status: WONTFIX (Archived)

## Component: AstaVerde.sol

## Issue Type: Economic / Intentional Phase 1 trade-off

## Description

Buying a single token from each batch prevents those batches from being counted toward base-price decreases. The current decrease logic considers only batches that are 100% unsold.

## Location

- File: `contracts/AstaVerde.sol`
- Function: `updateBasePrice()`
- Lines: 746-754 (eligibility check), 681-685 (known trade-offs comment)

```solidity
// Known trade-off
// ...
// - Buying 1 token from a batch excludes it from decrease calculations
// ...

// Eligibility check for price decreases
if (
    batch.creationTime <= thresholdStartTime &&
    batch.remainingTokens == batch.tokenIds.length &&
    !batchUsedInPriceDecrease[batch.batchId]
) {
    unsoldBatchCount++;
    batchUsedInPriceDecrease[batch.batchId] = true;
}
```

## Rationale (Phase 1)

- This behavior is explicitly acknowledged in the contract comments and is accepted for Phase 1.
- The effect is bounded: `basePrice` impacts only newly minted batches; existing batches have fixed `startingPrice` and independent daily decay.
- Maintaining simple, deterministic logic and bounded gas usage takes precedence in Phase 1.

## Resolution

- Leave as-is (WONTFIX) for Phase 1. We accept the risk of limited manipulation potential given the operational context and scope-of-impact.

## Operational Guidance

- Prefer larger `maxBatchSize` to reduce total batch count and the cost/feasibility of any attempted manipulation.
- Monitor `PriceUpdateIterationLimitReached` events to tune `maxPriceUpdateIterations` as needed.

## Future Considerations (Phase 2+)

- Percentage threshold (e.g., consider batches with ≥95% tokens remaining)
- Weighted decrease based on unsold percentage
- Time-locked eligibility snapshot at threshold time

## References

- `contracts/AstaVerde.sol` lines 681-685 (Known trade-offs comment)
- `contracts/AstaVerde.sol` lines 746-754 (Eligibility condition)
- Original ticket content (now archived here) for reproduction details and options
