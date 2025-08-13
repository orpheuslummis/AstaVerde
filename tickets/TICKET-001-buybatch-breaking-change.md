# TICKET-001: Critical - buyBatch Function Breaking Change

## Priority: P0 - BLOCKER
## Component: Smart Contract / Webapp Integration
## Assigned: Unassigned
## Status: Open
## Created: 2025-08-13

---

## Problem Statement

The `buyBatch` function in AstaVerde.sol has been modified with a breaking API change that will cause all existing integrations to fail. This is a **Phase 1 production contract** that should remain unchanged.

## Current Situation

### Old Signature (Phase 1 - Live):
```solidity
function buyBatch(
    uint256 batchID, 
    uint256 usdcAmount,  // Exact USDC amount being sent
    uint256 tokenAmount  // Number of tokens to buy
) external
```

### New Signature (Current PR):
```solidity
function buyBatch(
    uint256 batchID, 
    uint256 tokenAmount,  // Swapped position
    uint256 maxPrice,     // New parameter
    uint256 deadline      // New parameter
) external
```

## Impact Analysis

1. **Production Impact:** 
   - Existing users' transactions will fail
   - Webapp currently uses old signature
   - Any third-party integrations will break

2. **Code Locations Affected:**
   - contracts/AstaVerde.sol:265-295
   - webapp/src/hooks/useContractInteraction.ts:134-172
   - webapp/src/components/BatchCard.tsx (purchase flow)

3. **Current Webapp Call:**
```typescript
// webapp/src/hooks/useContractInteraction.ts:167
await writeContract({
    ...contractConfig,
    functionName: "buyBatch",
    args: [BigInt(batchId), exactTotalCost, BigInt(tokenAmount)], // OLD SIGNATURE!
});
```

## Root Cause

The change appears to add slippage protection (maxPrice) and deadline checking, which are good features but should not modify the existing Phase 1 interface.

## Proposed Solutions

### Option 1: Revert Changes (Recommended)
Restore original buyBatch signature and keep Phase 1 contract unchanged:

```solidity
// Keep original function
function buyBatch(
    uint256 batchID, 
    uint256 usdcAmount, 
    uint256 tokenAmount
) external whenNotPaused nonReentrant {
    // Original implementation
}

// Add new function for enhanced features
function buyBatchWithProtection(
    uint256 batchID, 
    uint256 tokenAmount,
    uint256 maxPrice,
    uint256 deadline
) external whenNotPaused nonReentrant {
    // New implementation with slippage protection
}
```

### Option 2: Update Webapp (Not Recommended)
Update all webapp calls to use new signature:

```typescript
// Would need to calculate maxPrice and deadline
const maxPrice = currentPrice * BigInt(110) / BigInt(100); // 10% slippage
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

await writeContract({
    functionName: "buyBatch",
    args: [BigInt(batchId), BigInt(tokenAmount), maxPrice, deadline],
});
```

**Why not recommended:** Phase 1 is live on mainnet. Contract changes require redeployment.

## Verification Steps

1. Check current mainnet AstaVerde contract ABI
2. Verify webapp integration points
3. Test with both old and new signatures
4. Ensure backward compatibility

## Acceptance Criteria

- [ ] Original buyBatch function signature restored
- [ ] Webapp continues to work without changes
- [ ] All tests pass
- [ ] No breaking changes to Phase 1 functionality
- [ ] New features (if needed) added via separate functions

## References

- Phase 1 Spec: Original marketplace requirements
- SSC_PLAN.md: States Phase 1 remains unchanged
- Git Diff: contracts/AstaVerde.sol changes

## Notes

This is a **CRITICAL BLOCKER** that must be resolved before merging to main or deploying to production. Phase 1 is live and must maintain backward compatibility.