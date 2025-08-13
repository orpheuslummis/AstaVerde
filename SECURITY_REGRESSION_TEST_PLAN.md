# Security Regression Test Plan

**Date**: 2025-08-13  
**Purpose**: Comprehensive testing to prevent regression of fixed security vulnerabilities  
**Test File**: `test/SecurityRegressions.ts`

## Overview

This test suite will verify that all previously identified and fixed security vulnerabilities remain patched. Each test is designed to fail if the vulnerability is reintroduced.

## Security Fixes to Test

### 1. Critical Vulnerabilities (3 fixes)

#### 1.1 Overpayment Refund Siphon ⚠️ CRITICAL
- **Original Issue**: Could drain contract by declaring high payment amount
- **Fix**: Removed `usdcAmount` parameter from `buyBatch`
- **Test Strategy**: Since parameter is removed, test the new signature works correctly

#### 1.2 Redeemed NFT Resale ⚠️ CRITICAL  
- **Original Issue**: Redeemed NFTs could be resold
- **Fix**: Added `&& !tokens[tokenId].redeemed` check in `getPartialIds`
- **Test Strategy**: Redeem token, transfer back, verify can't buy

#### 1.3 Vault Withdrawals During Pause ⚠️ CRITICAL
- **Original Issue**: Users trapped when contract paused
- **Fix**: Added `trustedVault` bypass mechanism
- **Test Strategy**: Pause contract, verify vault can still transfer

### 2. Quick Security Wins (3 fixes)

#### 2.1 SafeERC20 Usage ✅
- **Original Issue**: Unsafe token transfers
- **Fix**: Using SafeERC20 library
- **Test Strategy**: Verify transfers handle edge cases

#### 2.2 Producer Payout Rounding ✅
- **Original Issue**: Rounding dust accumulation
- **Fix**: Remainder goes to first producer
- **Test Strategy**: Verify no dust left in contract

#### 2.3 Slippage Protection ✅
- **Original Issue**: No protection against price changes
- **Fix**: Added `maxPrice` and `deadline` parameters
- **Test Strategy**: Test both protections work

### 3. DoS Prevention (2 fixes)

#### 3.1 Price Loop DoS 🔥
- **Original Issue**: Unbounded loop could exhaust gas
- **Fix**: Added `MAX_PRICE_UPDATE_ITERATIONS` limit
- **Test Strategy**: Create many batches, verify limit enforced

#### 3.2 Vault View DoS 🔥
- **Original Issue**: View functions could timeout
- **Fix**: Added `MAX_SCAN_CEILING` and pagination
- **Test Strategy**: Test bounds enforcement

### 4. Data Integrity (3 fixes)

#### 4.1 Ghost Token Redemption ✓
- **Original Issue**: Could redeem non-existent tokens
- **Fix**: Added `tokenId <= lastTokenID` check
- **Test Strategy**: Try redeeming invalid token IDs

#### 4.2 Price Underflow ✓
- **Original Issue**: Price calculation could underflow
- **Fix**: Added underflow protection
- **Test Strategy**: Advance time beyond decay period

#### 4.3 Zero Address Producer ✓
- **Original Issue**: Could mint with zero address
- **Fix**: Added validation
- **Test Strategy**: Try minting with zero address

## Test Implementation Strategy

### Test Structure
```typescript
describe("Security Regression Tests", function () {
    describe("Critical Vulnerabilities", function () {
        describe("Overpayment Siphon Prevention", ...)
        describe("Redeemed NFT Resale Prevention", ...)
        describe("Vault Pause Bypass", ...)
    });
    
    describe("SafeERC20 and Payments", function () {
        describe("Safe Transfers", ...)
        describe("Producer Payout Rounding", ...)
        describe("Slippage Protection", ...)
    });
    
    describe("DoS Prevention", function () {
        describe("Price Loop Limits", ...)
        describe("View Function Limits", ...)
    });
    
    describe("Data Integrity", function () {
        describe("Ghost Token Prevention", ...)
        describe("Price Underflow Protection", ...)
        describe("Zero Address Validation", ...)
    });
});
```

### Test Scenarios

#### Scenario 1: Overpayment Attack (Modified)
```typescript
// Since usdcAmount parameter removed, test new signature
it("Should only pull exact payment amount", async () => {
    // Setup: Fund buyer with exact amount
    const price = await astaVerde.getCurrentBatchPrice(1);
    await mockUSDC.mint(buyer, price);
    await mockUSDC.approve(astaVerde, price);
    
    // Execute: Buy batch
    await astaVerde.buyBatch(1, 1, maxPrice, deadline);
    
    // Verify: Buyer has 0 USDC left
    expect(await mockUSDC.balanceOf(buyer)).to.equal(0);
});
```

#### Scenario 2: Redeemed NFT Attack
```typescript
it("Should prevent resale of redeemed NFTs", async () => {
    // Setup: Buy and redeem NFT
    await buyNFT(buyer1, tokenId);
    await astaVerde.connect(buyer1).redeemToken(tokenId);
    
    // Attack: Transfer back to contract
    await astaVerde.connect(buyer1).safeTransferFrom(
        buyer1, astaVerde.address, tokenId, 1, "0x"
    );
    
    // Verify: Can't buy the redeemed NFT
    await expect(
        astaVerde.connect(buyer2).buyBatch(batchId, 1, maxPrice, deadline)
    ).to.be.revertedWith("Unable to get the required number of tokens");
});
```

#### Scenario 3: Vault Pause Trap
```typescript
it("Should allow vault transfers when paused", async () => {
    // Setup: Deposit to vault
    await vault.deposit(tokenId);
    
    // Pause main contract
    await astaVerde.pause();
    
    // Verify: Vault can still withdraw
    await expect(
        vault.withdraw(tokenId)
    ).to.not.be.reverted;
});
```

#### Scenario 4: Price Loop DoS
```typescript
it("Should limit price update iterations", async () => {
    // Create 500 batches
    for (let i = 0; i < 500; i++) {
        await astaVerde.mintBatch([producer], [`ipfs://${i}`]);
    }
    
    // Wait for price decrease trigger
    await time.increase(5 * 86400);
    
    // Should complete without gas exhaustion
    const tx = await astaVerde.mintBatch([producer], ["ipfs://new"]);
    const receipt = await tx.wait();
    
    // Verify gas usage is reasonable
    expect(receipt.gasUsed).to.be.lt(1000000);
    
    // Verify event emitted
    expect(tx).to.emit(astaVerde, "PriceUpdateIterationLimitReached");
});
```

#### Scenario 5: Slippage Protection
```typescript
it("Should protect against price increases", async () => {
    const oldPrice = await astaVerde.getCurrentBatchPrice(1);
    
    // Try to buy with low maxPrice
    await expect(
        astaVerde.buyBatch(1, 1, oldPrice - 1, deadline)
    ).to.be.revertedWith("Price exceeds maximum");
});

it("Should protect against stale transactions", async () => {
    const pastDeadline = Math.floor(Date.now() / 1000) - 1;
    
    await expect(
        astaVerde.buyBatch(1, 1, maxPrice, pastDeadline)
    ).to.be.revertedWith("Transaction expired");
});
```

## Expected Test Output

```
Security Regression Tests
  Critical Vulnerabilities
    ✓ Should only pull exact payment amount
    ✓ Should prevent resale of redeemed NFTs
    ✓ Should allow vault transfers when paused
  SafeERC20 and Payments
    ✓ Should use safe transfers
    ✓ Should distribute remainder to first producer
    ✓ Should protect against price slippage
    ✓ Should protect against stale transactions
  DoS Prevention
    ✓ Should limit price update iterations
    ✓ Should enforce maxScanRange ceiling
    ✓ Should provide pagination for view functions
  Data Integrity
    ✓ Should prevent ghost token redemption
    ✓ Should handle price underflow gracefully
    ✓ Should reject zero address producers

13 passing
```

## Implementation Checklist

- [ ] Create test file structure
- [ ] Implement critical vulnerability tests
- [ ] Implement payment security tests
- [ ] Implement DoS prevention tests
- [ ] Implement data integrity tests
- [ ] Add edge case coverage
- [ ] Verify all tests pass
- [ ] Document any limitations

## Success Criteria

1. **All tests pass** with current fixed code
2. **Tests would fail** if vulnerabilities were reintroduced
3. **100% coverage** of identified security fixes
4. **Clear documentation** of what each test validates

## Estimated Time

- Setup and structure: 15 minutes
- Critical tests: 30 minutes
- Payment tests: 20 minutes
- DoS tests: 20 minutes
- Data integrity tests: 15 minutes
- Edge cases and cleanup: 20 minutes

**Total: 2 hours** (Conservative estimate with buffer)