# Ticket #033: Webapp Inefficient Batch Operations

## Status: RESOLVED

**Priority**: MEDIUM  
**Type**: Performance/UX  
**Component**: Webapp (Bulk Deposit/Withdraw)  
**Created**: 2025-01-16

## Problem

The webapp's bulk deposit feature processes tokens sequentially, resulting in one transaction per token. This is gas-inefficient and provides poor UX for users depositing multiple tokens.

### Current Implementation

```typescript
// webapp/src/app/mytokens/page.tsx:223-233
// Deposit each token sequentially
// Note: In production, this should use a batch deposit function for gas efficiency
for (let i = 0; i < tokenIds.length; i++) {
    const tokenId = tokenIds[i];
    console.log(`Depositing token #${tokenId}...`);
    setBulkDepositProgress({ current: i + 1, total: tokenIds.length });
    await deposit(tokenId);
    depositedTokens.push(tokenId);
    console.log(`Token #${tokenId} deposited successfully`);
}
```

### Impact

- High gas costs (N transactions instead of 1)
- Slow operation (sequential waiting)
- Poor UX with multiple wallet confirmations
- Risk of partial completion if user cancels mid-operation

## Available Solution

`EcoStabilizerV2.sol` already implements batch operations:

```solidity
// contracts/EcoStabilizerV2.sol:18-50
function depositBatch(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
    // ... efficient batch processing
    ecoAsset.safeBatchTransferFrom(msg.sender, address(this), tokenIds, amounts, "");
    scc.mint(msg.sender, totalSCC);
}

function withdrawBatch(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
    // ... efficient batch withdrawal
}
```

## Solution Options

### Option 1: Deploy and Use EcoStabilizerV2 (Recommended)

1. Deploy EcoStabilizerV2 contract
2. Update webapp to detect V2 and use batch functions
3. Fallback to V1 sequential for older deployments

### Option 2: Add Warning for V1

- Display gas cost warning before bulk operations
- Show estimated gas costs
- Suggest depositing fewer tokens at once

### Option 3: Implement Client-Side Batching

- Use multicall pattern if available
- Group operations to reduce overhead

## Implementation Example

```typescript
// Detect and use V2 if available
const performBulkDeposit = async (tokenIds: bigint[]) => {
    if (contractVersion === "V2") {
        // Single batch transaction
        await depositBatch(tokenIds);
    } else {
        // Show warning
        const estimatedGas = tokenIds.length * AVG_DEPOSIT_GAS;
        if (!confirm(`This will require ${tokenIds.length} transactions. Continue?`)) {
            return;
        }
        // Existing sequential logic
        for (const tokenId of tokenIds) {
            await deposit(tokenId);
        }
    }
};
```

## Gas Cost Analysis

**Current (V1 Sequential):**

- 10 tokens = ~1,200,000 gas (10 × 120,000)
- Cost at 30 gwei = ~0.036 ETH

**With V2 Batch:**

- 10 tokens = ~300,000 gas (single transaction)
- Cost at 30 gwei = ~0.009 ETH
- **Savings: 75%**

## Testing Requirements

1. Test batch operations with various sizes (1, 10, 20 tokens)
2. Verify gas consumption matches estimates
3. Test error handling for partial failures
4. Ensure UI properly reflects progress

## Acceptance Criteria

- [ ] Batch operations use single transaction when possible
- [ ] Clear gas cost warnings for sequential operations
- [ ] Progress indication during operations
- [ ] Graceful error handling
- [ ] No breaking changes for V1 users

## Dependencies

- May require EcoStabilizerV2 deployment
- Should coordinate with DevOps for deployment strategy

## Related Issues

- #032: getUserLoans pagination (both are scalability issues)

## Resolution Details

**Resolved**: 2025-01-16  
**Solution**: Implemented EcoStabilizerV2 batch operations support with automatic version detection

### Implementation Summary

- Added automatic V2 contract detection via bytecode inspection
- Implemented `depositBatch()` and `withdrawBatch()` functions in useVault hook
- Updated UI to use batch operations when V2 is available
- Added gas cost warnings for V1 sequential operations (75% savings with V2)
- Maintained full backward compatibility with V1 contracts

### Files Modified

- `webapp/src/lib/contracts.ts` - Added V2 support and version detection
- `webapp/src/hooks/useVault.ts` - Implemented batch operations
- `webapp/src/app/mytokens/page.tsx` - Updated bulk deposit logic
- `webapp/src/config/EcoStabilizerV2.json` - Added V2 contract ABI

### Verification

- ✅ Batch operations use single transaction when V2 available
- ✅ Clear gas cost warnings for sequential operations (V1)
- ✅ Progress indication during operations
- ✅ Graceful error handling
- ✅ No breaking changes for V1 users
