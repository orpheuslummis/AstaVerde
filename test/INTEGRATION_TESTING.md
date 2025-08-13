# Phase 1 ↔ Phase 2 Integration Testing Guide

## Overview

This document details how our test suite validates the critical integration points between Phase 1 (AstaVerde marketplace) and Phase 2 (EcoStabilizer vault system).

## Integration Architecture

```
Phase 1: AstaVerde NFT Marketplace (Live on Base Mainnet)
    ↓ (NFT acquisition via marketplace)
Phase 2: EcoStabilizer Vault System (New deployment)
    ↓ (Cross-contract state reading)
Phase 1: AstaVerde Contract State (redeemed status, ownership)
```

## Critical Integration Points

### 1. NFT Acquisition Flow Integration

**Test Files**: All Phase 2 tests  
**Integration Point**: Users must acquire NFTs through proper Phase 1 marketplace before using Phase 2 vault

```typescript
// Phase 1: Proper NFT acquisition (integrated in every Phase 2 test)
await astaVerde.mintBatch([producer.address], ["QmTestCID"]);
const batchPrice = await astaVerde.getCurrentBatchPrice(1);
await mockUSDC.connect(user1).approve(astaVerde.target, batchPrice);
await astaVerde.connect(user1).buyBatch(1, batchPrice, 1);

// Phase 2: Vault operations on properly acquired NFTs
await astaVerde.connect(user1).setApprovalForAll(ecoStabilizer.target, true);
await ecoStabilizer.connect(user1).deposit(1); // Real NFT from marketplace
```

**Why This Matters**: Ensures vault only works with legitimately acquired NFTs, not test-minted tokens.

### 2. Redeemed Asset Protection Integration

**Test File**: `VaultRedeemed.ts`  
**Integration Point**: Vault must read AstaVerde contract state to prevent redeemed NFTs from being used as collateral

```typescript
// Phase 1: User redeems NFT (makes it worthless)
await astaVerde.connect(user1).redeemToken(1);

// Integration: Vault reads AstaVerde state
const tokenInfo = await astaVerde.tokens(1);
console.log("Redeemed status:", tokenInfo.redeemed); // true

// Phase 2: Vault correctly rejects redeemed NFT
await expect(ecoStabilizer.connect(user1).deposit(1)).to.be.revertedWith("redeemed asset");
```

**Security Impact**: Critical protection against using worthless NFTs as loan collateral.

### 3. Cross-Contract State Reading Integration

**Test Files**: All Phase 2 tests  
**Integration Point**: Vault contract reads live state from AstaVerde contract

```typescript
// IAstaVerde interface enables cross-contract communication
interface IAstaVerde is IERC1155 {
    function tokens(uint256) external view returns (
        address owner,
        uint256 tokenId,
        address producer,
        string memory cid,
        bool redeemed  // ← Critical state read by vault
    );
}

// Vault deposit function integration
function deposit(uint256 tokenId) external {
    (, , , , bool redeemed) = ecoAsset.tokens(tokenId); // ← Reading Phase 1 state
    require(!redeemed, "redeemed asset"); // ← Phase 2 protection
    // ... rest of deposit logic
}
```

**Technical Integration**: Vault contract references AstaVerde via constructor parameter, not hardcoded address.

### 4. ERC-1155 Transfer Integration

**Test Files**: `EcoStabilizer.ts`, `VaultCoverageGapsFixed.ts`  
**Integration Point**: NFTs must transfer correctly between user ↔ AstaVerde ↔ vault

```typescript
// Pre-deposit: User owns NFT
expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(0);

// Deposit: NFT transfers from user to vault
await ecoStabilizer.connect(user1).deposit(1);
expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(0);
expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(1);

// Withdraw: NFT transfers from vault back to user
await ecoStabilizer.connect(user1).withdraw(1);
expect(await astaVerde.balanceOf(user1.address, 1)).to.equal(1);
expect(await astaVerde.balanceOf(ecoStabilizer.target, 1)).to.equal(0);
```

**Custody Integration**: User gets back their exact original NFT, not a different one.

### 5. Multi-User Integration Scenarios

**Test File**: `VaultCoverageGapsFixed.ts`  
**Integration Point**: Multiple users with different NFTs from different batches

```typescript
// Phase 1: Users acquire different NFTs from different batches
await astaVerde.mintBatch([producer.address], ["QmTestCID1"]);
await astaVerde.mintBatch([producer.address], ["QmTestCID2"]);

await astaVerde.connect(user1).buyBatch(1, batch1Price, 1); // Gets token ID 1
await astaVerde.connect(user2).buyBatch(2, batch2Price, 1); // Gets token ID 2

// Phase 2: Independent vault positions
await ecoStabilizer.connect(user1).deposit(1); // user1's NFT
await ecoStabilizer.connect(user2).deposit(2); // user2's NFT

// Security: Users can only withdraw their own NFTs
await ecoStabilizer.connect(user1).withdraw(1); // ✅ Success
await expect(ecoStabilizer.connect(user1).withdraw(2)).to.be.revertedWith("not borrower"); // ✅ Properly rejected
```

## Test Execution Patterns

### Full Integration Test Pattern

```typescript
describe("Integration Feature", function () {
  async function deployIntegrationFixture() {
    // 1. Deploy Phase 1 contracts (AstaVerde + MockUSDC)
    const astaVerde = await AstaVerdeFactory.deploy(owner, mockUSDC.target);

    // 2. Deploy Phase 2 contracts referencing Phase 1
    const ecoStabilizer = await EcoStabilizerFactory.deploy(
      astaVerde.target, // ← Integration reference
      scc.target
    );

    // 3. Configure cross-contract permissions
    await scc.grantRole(MINTER_ROLE, ecoStabilizer.target);

    // 4. Execute Phase 1 operations (real marketplace flow)
    await astaVerde.mintBatch([producer.address], ["QmTestCID"]);
    await mockUSDC.connect(user1).approve(astaVerde.target, batchPrice);
    await astaVerde.connect(user1).buyBatch(1, batchPrice, 1);

    return { astaVerde, ecoStabilizer, scc, mockUSDC, users... };
  }

  it("should handle integration scenario", async function () {
    const { contracts, users } = await loadFixture(deployIntegrationFixture);

    // 5. Execute Phase 2 operations on Phase 1 NFTs
    // 6. Verify cross-contract state consistency
    // 7. Test security boundaries
    // 8. Validate gas costs
  });
});
```

### Security Integration Validation

```typescript
// Verify Phase 1 → Phase 2 data flow
const tokenData = await astaVerde.tokens(tokenId);
expect(tokenData.redeemed).to.equal(false); // Phase 1 state

await ecoStabilizer.connect(user).deposit(tokenId); // Phase 2 accepts

await astaVerde.connect(user).redeemToken(tokenId); // Phase 1 state change
const redeemedData = await astaVerde.tokens(tokenId);
expect(redeemedData.redeemed).to.equal(true); // Phase 1 state updated

await expect(ecoStabilizer.connect(user).deposit(tokenId)).to.be.revertedWith("redeemed asset"); // Phase 2 reads new state
```

## Integration Test Coverage Matrix

| **Phase 1 Function**  | **Phase 2 Integration**    | **Test File**      | **Status** |
| --------------------- | -------------------------- | ------------------ | ---------- |
| `mintBatch()`         | Setup for vault testing    | All Phase 2 tests  | ✅         |
| `buyBatch()`          | Real NFT acquisition flow  | All Phase 2 tests  | ✅         |
| `tokens()` getter     | Redeemed status checking   | `VaultRedeemed.ts` | ✅         |
| `redeemToken()`       | Protection trigger         | `VaultRedeemed.ts` | ✅         |
| `balanceOf()`         | NFT ownership verification | All Phase 2 tests  | ✅         |
| `safeTransferFrom()`  | NFT custody transfers      | `EcoStabilizer.ts` | ✅         |
| `setApprovalForAll()` | Vault transfer permissions | All Phase 2 tests  | ✅         |

## Integration Deployment Testing

### Testnet Integration Validation

```typescript
// Deployment sequence validation
const astaVerdeAddress = "0x..."; // Existing Phase 1 deployment
const scc = await SCCFactory.deploy();
const vault = await VaultFactory.deploy(astaVerdeAddress, scc.target);

// Integration verification
const connectedAstaVerde = await ethers.getContractAt("IAstaVerde", astaVerdeAddress);
const tokenData = await connectedAstaVerde.tokens(existingTokenId);
console.log("Can read Phase 1 state:", tokenData);

// End-to-end integration test
await vault.deposit(existingTokenId); // Should work with real Phase 1 NFT
```

### Mainnet Integration Checklist

- [ ] Vault constructor points to correct AstaVerde mainnet address
- [ ] IAstaVerde interface matches deployed AstaVerde contract
- [ ] Redeemed asset protection works with real redeemed NFTs
- [ ] Gas costs acceptable for mainnet usage
- [ ] Multiple users can operate independently
- [ ] Edge cases handled gracefully

## Common Integration Issues & Solutions

### Issue: Interface Mismatch

**Problem**: IAstaVerde interface doesn't match deployed AstaVerde contract  
**Solution**: Generate interface from deployed contract ABI  
**Test**: Compilation and deployment tests catch this

### Issue: Gas Costs Too High

**Problem**: Integration operations exceed gas limits  
**Solution**: Optimize cross-contract calls and state reads  
**Test**: Gas measurement tests validate targets

### Issue: State Reading Failures

**Problem**: Vault can't read AstaVerde state correctly  
**Solution**: Proper interface inheritance and function signatures  
**Test**: All Phase 2 tests verify state reading

### Issue: NFT Transfer Failures

**Problem**: ERC-1155 transfers fail between contracts  
**Solution**: Proper approval mechanisms and safe transfer usage  
**Test**: Transfer integration tests catch issues

## Performance Integration Testing

### Gas Cost Integration Validation

```typescript
// Real-world gas costs with full integration
const depositTx = await ecoStabilizer.connect(user1).deposit(1);
const receipt = await depositTx.wait();

console.log("Deposit gas (with Phase 1 integration):", receipt.gasUsed);
// Target: <150k gas including cross-contract calls

const withdrawTx = await ecoStabilizer.connect(user1).withdraw(1);
const withdrawReceipt = await withdrawTx.wait();

console.log("Withdraw gas (with Phase 1 integration):", withdrawReceipt.gasUsed);
// Target: <120k gas including cross-contract calls
```

### Optimization Strategies

1. **Minimize Cross-Contract Calls**: Cache frequently read state
2. **Efficient State Reading**: Read multiple values in single call
3. **Optimize Transfer Logic**: Use most efficient ERC-1155 functions
4. **Batch Operations**: Group related operations when possible

## Conclusion

Our integration testing strategy ensures that Phase 2 (vault system) works seamlessly with Phase 1 (marketplace system) by:

1. **Testing Real Flows**: Every test uses proper Phase 1 NFT acquisition
2. **Validating Cross-Contract Communication**: Vault correctly reads AstaVerde state
3. **Ensuring Security**: Redeemed asset protection works end-to-end
4. **Verifying Performance**: Gas costs measured with full integration
5. **Covering Edge Cases**: Handles unexpected cross-contract scenarios

This comprehensive integration testing gives **high confidence** that Phase 2 can be safely deployed alongside the existing Phase 1 system in production.
