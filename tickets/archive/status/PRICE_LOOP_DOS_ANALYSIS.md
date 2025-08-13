# Price Loop DoS - Detailed Analysis

## Problem Overview

The `updateBasePrice()` function contains an unbounded loop that iterates through ALL batches within a 90-day window. This creates a critical DoS vulnerability that worsens over time.

## Current Implementation Issues

### Location: `contracts/AstaVerde.sol` lines 478-488

```solidity
// PROBLEMATIC CODE - Line 478
for (uint256 i = batches.length; i > 0 && batches[i - 1].creationTime >= windowStart; i--) {
    Batch storage batch = batches[i - 1];
    if (
        batch.creationTime <= thresholdStartTime &&
        batch.remainingTokens == batch.tokenIds.length &&
        !batchUsedInPriceDecrease[batch.batchId]
    ) {
        unsoldBatchCount++;
        batchUsedInPriceDecrease[batch.batchId] = true;
    }
}
```

### The Problem

1. **Unbounded Iteration**: Loop continues as long as batches are within 90-day window
2. **Growing Over Time**: More batches = more iterations = more gas
3. **Called Frequently**: 
   - Line 193: Called in `mintBatch()`
   - Line 289: Called in `buyBatch()`
4. **Attack Vector**: Attacker can create many small batches to exhaust gas

## Attack Scenario

### Setup
- Attacker creates 1000+ small batches over 90 days
- Each batch has minimal tokens (1-2)
- Total cost: ~1000 * gas cost per mint

### Impact
- `updateBasePrice()` now iterates 1000+ times
- Gas cost exceeds block gas limit
- `buyBatch()` becomes unusable (reverts)
- `mintBatch()` becomes unusable (reverts)
- **Protocol is effectively bricked**

## Gas Analysis

### Current Gas Consumption (Estimated)
- Per iteration: ~2,000 gas (storage reads + comparisons)
- 100 batches: ~200,000 gas
- 500 batches: ~1,000,000 gas
- 1000 batches: ~2,000,000 gas
- **Block gas limit**: 30,000,000 (but transaction limit much lower)

### Real-World Impact
- At 500+ batches in 90 days, transactions start failing
- Normal operation: ~10-20 batches/day = 900-1800 in 90 days
- **Protocol becomes unusable within 3-6 months of normal operation**

## Root Cause

The algorithm tries to be comprehensive but doesn't account for:
1. Scalability over time
2. Adversarial batch creation
3. Gas limits of Ethereum/L2s

## Solution Approaches

### Option 1: Hard Iteration Limit (Recommended)
```solidity
uint256 constant MAX_PRICE_UPDATE_ITERATIONS = 100;
uint256 iterations = 0;

for (uint256 i = batches.length; i > 0 && iterations < MAX_PRICE_UPDATE_ITERATIONS; i--) {
    if (batches[i - 1].creationTime < windowStart) break;
    
    // existing logic
    iterations++;
}
```

**Pros:**
- Simple to implement
- Predictable gas consumption
- Still processes most recent/relevant batches

**Cons:**
- May miss some older batches
- Requires tuning the limit

### Option 2: Sampling Strategy
```solidity
// Only check every Nth batch for older batches
uint256 skipFactor = batches.length > 200 ? batches.length / 100 : 1;

for (uint256 i = batches.length; i > 0; i -= skipFactor) {
    // Process batch
}
```

**Pros:**
- Scales with batch count
- Still samples across time range

**Cons:**
- More complex
- May miss important batches

### Option 3: Separate Tracking
```solidity
// Maintain separate array of unsold batch IDs
uint256[] public unsoldBatches;

// Update on mint/buy
// Iterate only unsoldBatches in updateBasePrice
```

**Pros:**
- Most efficient
- Direct access to relevant batches

**Cons:**
- Requires storage refactor
- More complex state management

## Recommended Fix

### Implementation Plan

1. **Add iteration limit constant**:
```solidity
uint256 constant MAX_PRICE_UPDATE_ITERATIONS = 100;
```

2. **Update price increase loop** (lines 451-461):
```solidity
uint256 batchesToCheck = Math.min(10, batches.length);
// Already limited to 10 - OK
```

3. **Update price decrease loop** (lines 478-488):
```solidity
uint256 iterations = 0;
for (uint256 i = batches.length; 
     i > 0 && iterations < MAX_PRICE_UPDATE_ITERATIONS; 
     i--) {
    
    Batch storage batch = batches[i - 1];
    
    // Early exit if before window
    if (batch.creationTime < windowStart) break;
    
    if (
        batch.creationTime <= thresholdStartTime &&
        batch.remainingTokens == batch.tokenIds.length &&
        !batchUsedInPriceDecrease[batch.batchId]
    ) {
        unsoldBatchCount++;
        batchUsedInPriceDecrease[batch.batchId] = true;
    }
    
    iterations++;
}
```

4. **Add monitoring event**:
```solidity
event PriceUpdateIterationLimitReached(uint256 batchesProcessed, uint256 totalBatches);

if (iterations >= MAX_PRICE_UPDATE_ITERATIONS && i > 0) {
    emit PriceUpdateIterationLimitReached(iterations, batches.length);
}
```

## Testing Requirements

### Unit Tests
1. Create 200 batches, verify gas consumption stays under limit
2. Verify price adjustments still work with iteration limit
3. Test that most recent batches are prioritized
4. Verify event emission when limit reached

### Gas Tests
```solidity
function testGasConsumptionWithManyBatches() {
    // Create 500 batches
    for (uint i = 0; i < 500; i++) {
        astaVerde.mintBatch([producer], ["cid"]);
    }
    
    // Measure gas for buyBatch (includes updateBasePrice)
    uint256 gasBefore = gasleft();
    astaVerde.buyBatch(1, 1, maxPrice, deadline);
    uint256 gasUsed = gasBefore - gasleft();
    
    // Should stay under reasonable limit
    assert(gasUsed < 500000);
}
```

## Impact of Fix

### Positive
- Prevents DoS attacks
- Ensures protocol remains usable
- Predictable gas consumption
- No significant functionality loss

### Considerations
- May not process all historical batches
- Price adjustments based on sample rather than complete data
- Monitoring needed to tune `MAX_PRICE_UPDATE_ITERATIONS`

## Configuration Recommendations

### For Different Networks
- **Ethereum Mainnet**: MAX_ITERATIONS = 50 (higher gas costs)
- **Base/L2s**: MAX_ITERATIONS = 100 (lower gas costs)
- **Test Networks**: MAX_ITERATIONS = 200 (for testing)

### Monitoring
- Track `PriceUpdateIterationLimitReached` events
- Adjust limit if frequently hitting cap
- Consider batch cleanup mechanism for very old batches

## Conclusion

This is a **critical performance issue** that will cause the protocol to fail under normal operation within months. The fix is straightforward and should be implemented immediately before mainnet deployment.

The recommended approach (Option 1 with hard limit) balances simplicity, effectiveness, and minimal code changes while completely eliminating the DoS vector.