# Ticket: Prevent Price Underflow in `getCurrentBatchPrice`

- Component: `contracts/AstaVerde.sol`
- Severity: High
- Type: Logic/Safety Bug
- **Status: ✅ FIXED** - Underflow prevention added (lines 243-246)

## Background / Justification

`getCurrentBatchPrice` computes `decayedPrice = startingPrice - (days * dailyPriceDecay)` and only then clamps to `priceFloor`. For sufficiently old batches, subtraction underflows and reverts, breaking reads and purchases.

## Impact

- DoS on price reads and purchases for old batches; can stall user flows and price display.

## Tasks

1. Compute the decrement with saturation:
    - `uint256 elapsed = (block.timestamp - creationTime) / SECONDS_IN_A_DAY;`
    - `uint256 dec = Math.min(elapsed * dailyPriceDecay, startingPrice);`
    - `uint256 decayed = startingPrice - dec;`
2. Return `max(decayed, priceFloor)`.
3. Add comments clarifying the saturation to avoid future regressions.

## Acceptance Criteria

- No underflow occurs regardless of elapsed days; function never reverts due to subtraction here.
- Unit test covers long horizon (e.g., > startingPrice/dailyPriceDecay days) and still returns `priceFloor`.

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts` (add coverage)

## Test Plan

- Add a test advancing time far beyond the point where `startingPrice - elapsed*dailyPriceDecay` would underflow; assert returned price equals `priceFloor` without revert.
