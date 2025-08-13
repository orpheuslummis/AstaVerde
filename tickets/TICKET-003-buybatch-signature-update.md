# TICKET-003: Update Webapp for New buyBatch Signature

## Priority: P2 - MEDIUM (Can defer - not blocking Phase 2)
## Component: Webapp / Test Suite
## Assigned: Unassigned
## Status: Documented - Deferred
## Created: 2025-08-13

---

## Executive Summary

The `buyBatch` function has been improved with slippage and deadline protection. Since AstaVerde Phase 1 is not yet deployed to mainnet (only Phase 2 vault is the focus), we can keep the improved signature and update calling code.

## Current Situation

### Contract (New - Improved):
```solidity
function buyBatch(
    uint256 batchID,
    uint256 tokenAmount,
    uint256 maxPrice,    // NEW: Maximum price user will pay
    uint256 deadline     // NEW: Transaction expiration time
)
```

### Webapp (Old - Needs Update):
```typescript
args: [BigInt(batchId), exactTotalCost, BigInt(tokenAmount)]
```

## Benefits of New Signature

1. **Gas Savings**: ~5,000 gas saved by removing refund logic
2. **Security**: Slippage protection prevents sandwich attacks
3. **Modern Pattern**: Uses SafeERC20 instead of deprecated transfer()
4. **Cleaner Logic**: Contract only pulls exact amount needed

## Implementation Requirements

### 1. Webapp Updates (Primary)

**File: `webapp/src/services/blockchain/marketplaceService.ts` (Line 56-83)**
```typescript
async buyBatch(batchId: number, tokenAmount: number): Promise<`0x${string}`> {
    const currentUnitPrice = await this.getCurrentBatchPrice(batchId);
    
    // Add 2% slippage tolerance
    const maxPrice = currentUnitPrice + (currentUnitPrice * 2n / 100n);
    
    // Set deadline to 5 minutes from now
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
    
    // Approve exact amount
    const exactTotalCost = currentUnitPrice * BigInt(tokenAmount);
    await this.ensureUsdcApproval(exactTotalCost);
    
    // New signature
    args: [BigInt(batchId), BigInt(tokenAmount), maxPrice, deadline]
}
```

**Additional webapp files to update:**
- `webapp/src/hooks/useContractInteraction.ts` (lines 151-156, 417-436)
- `webapp/src/types.ts` (line 34)
- `webapp/src/features/marketplace/types.ts` (line 40)

### 2. Test Updates (116 occurrences)

**Pattern for all test updates:**
```javascript
// OLD:
await astaVerde.connect(user1).buyBatch(batchID, totalCost, tokenAmount);

// NEW:
const currentPrice = await astaVerde.getCurrentBatchPrice(batchID);
const maxPrice = currentPrice; // No slippage in tests
const deadline = ethers.MaxUint256; // Never expires in tests
await astaVerde.connect(user1).buyBatch(batchID, tokenAmount, maxPrice, deadline);
```

**Test files requiring updates (18 files, 116 total occurrences):**
- `test/AstaVerde.logic.behavior.ts` (22)
- `test/EcoStabilizer.ts` (5)
- `test/VaultBoundaries.ts` (11)
- `test/IntegrationPhase1Phase2.ts` (3)
- `test/SCCInvariants.ts` (3)
- `test/SecurityDeployment.ts` (2)
- `test/VaultDirectTransfer.ts` (2)
- `test/VaultCoverageGapsFixed.ts` (2)
- `test/VaultReentrancy.ts` (2)
- `test/VaultRedeemed.ts` (1)
- Additional test files...

### 3. E2E Test Updates

**File: `webapp/e2e/fixtures/contract-helper.ts`**
```typescript
async buyBatch(batchId: number, tokenAmount: number) {
    const currentPrice = await this.getCurrentBatchPrice(batchId);
    const maxPrice = currentPrice * 1.02; // 2% slippage
    const deadline = Math.floor(Date.now() / 1000) + 300;
    return this.contract.buyBatch(batchId, tokenAmount, maxPrice, deadline);
}
```

## Configuration Recommendations

### Slippage Settings
- **Default**: 2% (reasonable for stable prices)
- **User-configurable**: Allow 1-5% range in UI
- **Tests**: 0% (use exact price)

### Deadline Settings
- **Default**: 5 minutes (300 seconds)
- **Maximum**: 30 minutes for large purchases
- **Tests**: MaxUint256 (never expire)

## Migration Steps

1. Update webapp service layer
2. Update hook signatures
3. Update type definitions
4. Update all test files
5. Run test suite: `npm run test`
6. Test locally: `npm run dev`
7. Update documentation

## Testing Checklist

- [ ] All 171 tests pass
- [ ] Webapp builds successfully
- [ ] Manual purchase flow works
- [ ] Slippage protection triggers correctly
- [ ] Deadline validation works
- [ ] Gas usage remains optimal

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Missed test update | Test failure | Use grep to find all occurrences |
| Wrong slippage % | Transaction fails | Start with generous 2-5% |
| Deadline too short | User frustration | Default 5 min is reasonable |

## Decision Log

- **2025-08-13**: Documented as deferred ticket to maintain focus on SSC_PLAN.md completion
- Contract improvement is good but not blocking Phase 2 vault implementation
- Can be implemented after Phase 2 is complete

## Notes

This is a **good improvement** but **not critical** for Phase 2 launch. The old signature with refunds still works, just less efficiently. Recommend implementing this after Phase 2 vault is complete and tested.

**Time Estimate**: 2-3 hours total
- Webapp: 30 minutes
- Tests: 1.5 hours
- Verification: 30 minutes

## Related Documents

- SSC_PLAN.md (Phase 2 implementation focus)
- contracts/AstaVerde.sol (contains new signature)
- Original Phase 1 specification

---

*Status: DEFERRED - Focus on completing Phase 2 vault first*