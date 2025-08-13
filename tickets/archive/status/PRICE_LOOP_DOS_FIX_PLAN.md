# Price Loop DoS Fix - Implementation Plan

## Objective
Prevent DoS attacks and ensure long-term protocol usability by limiting iterations in `updateBasePrice()` function.

## Current State Analysis

### Problem Location
- **File**: `contracts/AstaVerde.sol`
- **Function**: `updateBasePrice()` (lines 438-498)
- **Critical Loop**: Line 478 - unbounded iteration through batches

### Current Logic Flow
1. **Price Increase Check** (lines 448-468)
   - Already limited to 10 batches ✅
   - No fix needed here

2. **Price Decrease Check** (lines 471-497)
   - **PROBLEM**: Unbounded loop through all batches in 90-day window
   - Can iterate 1000+ times
   - Needs iteration limit

## Implementation Plan

### Step 1: Add Constants
```solidity
// After line 20 (with other constants)
uint256 public constant MAX_PRICE_UPDATE_ITERATIONS = 100;
```

### Step 2: Add Event for Monitoring
```solidity
// After line 75 (with other events)
event PriceUpdateIterationLimitReached(uint256 batchesProcessed, uint256 totalBatches);
```

### Step 3: Update Price Decrease Loop
Replace lines 478-488 with:
```solidity
uint256 iterations = 0;
uint256 iterationLimitReached = 0;

for (uint256 i = batches.length; i > 0; i--) {
    // Check iteration limit first
    if (iterations >= MAX_PRICE_UPDATE_ITERATIONS) {
        iterationLimitReached = iterations;
        break;
    }
    
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

// Emit event if limit was reached
if (iterationLimitReached > 0) {
    emit PriceUpdateIterationLimitReached(iterationLimitReached, batches.length);
}
```

### Step 4: Create Test File
Create `test/PriceLoopDoSFix.ts` with:

1. **Test: Normal operation under limit**
   - Create 50 batches
   - Verify updateBasePrice works normally
   - Check gas consumption

2. **Test: Behavior at limit**
   - Create 150 batches
   - Verify stops at 100 iterations
   - Check event emission

3. **Test: DoS prevention**
   - Create 500 batches
   - Verify buyBatch still works
   - Measure gas stays under limit

4. **Test: Price adjustments still work**
   - Create batches with various sale times
   - Verify price increases/decreases still trigger
   - Confirm most recent batches prioritized

## Code Changes Summary

### Files to Modify
1. `contracts/AstaVerde.sol`
   - Add MAX_PRICE_UPDATE_ITERATIONS constant
   - Add PriceUpdateIterationLimitReached event
   - Update price decrease loop with iteration limit
   - Add event emission when limit reached

### Files to Create
1. `test/PriceLoopDoSFix.ts`
   - Comprehensive test suite for DoS prevention
   - Gas consumption tests
   - Functionality preservation tests

## Risk Assessment

### Changes are Safe Because:
1. **Price increase logic unchanged** - Already limited to 10 batches
2. **Most recent batches prioritized** - Loop starts from newest
3. **Early exit preserved** - Still exits when outside window
4. **Monitoring added** - Event alerts when limit reached
5. **Reasonable limit** - 100 iterations handles ~3 months of daily batches

### Edge Cases Handled:
1. **Empty batches array** - Existing check at line 440
2. **All batches outside window** - Early exit still works
3. **Exactly at limit** - Processes 100 then stops
4. **Very old batches** - Window start prevents processing

## Testing Strategy

### Unit Tests
1. Verify iteration limit enforced
2. Check event emission
3. Confirm price logic still works

### Integration Tests
1. Test with SecurityFixes.ts scenarios
2. Verify no regression in QuickWins.ts

### Gas Tests
1. Measure gas with 50, 100, 200, 500 batches
2. Confirm stays under reasonable limits
3. Compare before/after gas consumption

## Rollback Plan
If issues discovered:
1. Remove iteration limit check
2. Remove event emission
3. Revert to original loop

The changes are minimal and isolated, making rollback simple.

## Success Criteria
✅ Iteration limit enforced at 100
✅ Event emitted when limit reached
✅ Gas consumption bounded
✅ Price adjustments still functional
✅ All existing tests pass
✅ New DoS tests pass

## Implementation Order
1. Add constant and event declarations
2. Update the price decrease loop
3. Create and run tests
4. Verify no regressions
5. Update documentation
6. Archive ticket

This plan ensures a safe, systematic fix that completely eliminates the DoS vulnerability while preserving all existing functionality.