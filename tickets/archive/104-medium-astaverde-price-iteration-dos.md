# Ticket #104: MEDIUM - Price Update Iteration Limit Causes Pricing Inconsistencies

## Priority: MEDIUM

## Status: WONTFIX (Archived)

We will keep the current gas-bounded design. Price increases scan only the last 10 batches and are not iteration-limited; price decreases are iteration-bounded and scoped to the 90-day `PRICE_WINDOW`. We will monitor `PriceUpdateIterationLimitReached` and tune `maxPriceUpdateIterations` and `maxBatchSize` as needed.

## Component: AstaVerde.sol

## Issue Type: Economic / DoS Protection Trade-off

## Description

The `maxPriceUpdateIterations` limit in the `updateBasePrice()` function can cause incomplete price adjustments, leading to pricing inconsistencies. While this prevents DoS attacks, it creates an "eventual consistency" model that could be exploited through timing attacks.

## Location

- File: `contracts/AstaVerde.sol`
- Function: `updateBasePrice()`
- Lines: 686-762
- Configuration: `maxPriceUpdateIterations` (line 68)

## Current Implementation

```solidity
uint256 public maxPriceUpdateIterations = 100; // Line 68

function updateBasePrice() private {
    // ...
    for (uint256 i = batches.length; i > 0; i--) {
        // Check iteration limit to prevent DoS
        if (iterations >= maxPriceUpdateIterations) {
            limitReached = true;
            emit PriceUpdateIterationLimitReached(iterations, batches.length);
            break; // Exit early, leaving some batches unprocessed
        }
        // ... price adjustment logic
        iterations++;
    }
    // ...
}
```

## Problems

### 1. Incomplete Price Adjustments

- If there are more batches than `maxPriceUpdateIterations`, some batches won't be evaluated
- Price decreases may not account for all unsold inventory
- Price increases consider only the last 10 recent batches (by design), not capped by iterations

### 2. Timing Attack Vector

```
Scenario:
1. System has 150 batches, iteration limit is 100
2. Batches 101-150 are unsold for >4 days (should trigger price decrease)
3. Attacker times purchase right after a price update
4. Only batches 51-150 get checked (most recent 100)
5. Older unsold batches 1-50 don't contribute to price decrease
6. Attacker gets better price than market should dictate
```

### 3. Eventual Consistency Issues

- Price adjustments happen gradually over multiple transactions
- Different users see different "true" prices depending on timing
- Makes price discovery unpredictable

## Impact

- **Economic**: Incorrect pricing can lead to arbitrage opportunities
- **Fairness**: Sophisticated users can exploit timing for better prices
- **UX**: Price volatility between transactions is confusing
- **Gas**: Buyers pay unpredictable gas costs (100k-300k extra)

## Resolution

- Leave as-is (WONTFIX). Rationale: bounded gas/DoS protection outweighs marginal pricing lag; `basePrice` impacts only new batches. Timing advantages are limited and operationally manageable.
- Operational actions: monitor `PriceUpdateIterationLimitReached` events; adjust `maxPriceUpdateIterations` (see Configuration) and prefer larger `maxBatchSize` to reduce total batches.
- Future option (if needed): add a checkpoint for price decreases to progress across calls without increasing per-call gas.

## Current Mitigation

The contract emits `PriceUpdateIterationLimitReached` events when limit is hit, but:

- No automatic adjustment mechanism
- Requires manual monitoring
- No user visibility into whether full update occurred

## Recommended Fixes

### Option 1: Separate Price Oracle

```solidity
// Maintain a separate price state updated by owner/keeper
mapping(uint256 => uint256) public batchPriceOverrides;
bool public useOraclePrice;

function updatePricesOffchain(uint256[] calldata batchIds, uint256[] calldata prices)
    external onlyOwner {
    for (uint256 i = 0; i < batchIds.length; i++) {
        batchPriceOverrides[batchIds[i]] = prices[i];
    }
}
```

### Option 2: Checkpoint System

```solidity
struct PriceCheckpoint {
    uint256 timestamp;
    uint256 basePrice;
    uint256 lastProcessedBatch;
}

PriceCheckpoint public lastCheckpoint;

function updateBasePrice() private {
    uint256 startFrom = lastCheckpoint.lastProcessedBatch;
    // Process next chunk of batches
    // Save checkpoint for next iteration
}
```

### Option 3: Reduce Batch Creation

- Increase `maxBatchSize` to reduce total batch count
- Implement batch merging for unsold inventory
- Archive old completed batches

### Option 4: Gas Optimization

```solidity
// Cache batch data in memory to reduce SLOAD operations
struct CachedBatch {
    uint256 id;
    uint256 creationTime;
    uint256 remainingTokens;
    bool processed;
}

// Process in memory, single storage write at end
```

## Configuration Recommendations

Based on in-contract guidance and operations:

- Production: 60-100 (start at 100, adjust based on gas costs)
- High activity: 50-60 to reduce buyer gas (accept more eventual consistency)
- Low activity: Can increase to 100+ for better accuracy
- Many batches: Prefer larger `maxBatchSize` to reduce total batch count

## Testing Required

- Benchmark gas usage at different iteration limits
- Test price consistency with >100 batches
- Timing attack simulation
- Price convergence analysis

## References

- Lines 729-734: Iteration limit check
- Line 732: `PriceUpdateIterationLimitReached` event
- Gas analysis: 100k-300k additional gas per buyer
