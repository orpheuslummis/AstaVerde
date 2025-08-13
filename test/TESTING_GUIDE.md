# AstaVerde Test Suite - Comprehensive Guide

This document provides a complete overview of the AstaVerde test architecture, covering both Phase 1 (marketplace) and Phase 2 (vault system) testing strategies.

## 📊 Test Statistics

- **Total Tests**: 109 ✅
- **Statement Coverage**: 91.01%
- **Branch Coverage**: 67.61%
- **Function Coverage**: 75%
- **Line Coverage**: 92.37%

## 🏗️ Test Architecture

### Core Test Files

| Test File                     | Purpose                          | Test Count  | Focus Area                                |
| ----------------------------- | -------------------------------- | ----------- | ----------------------------------------- |
| `AstaVerde.logic.behavior.ts` | Phase 1 comprehensive testing    | ~35 tests   | Dutch auction, pricing, marketplace logic |
| `EcoStabilizer.ts`            | Phase 2 vault core functionality | ~25 tests   | Deposit, withdraw, admin functions        |
| `StabilizedCarbonCoin.ts`     | ERC-20 debt token testing        | ~15 tests   | Minting, burning, access control          |
| `IntegrationPhase1Phase2.ts`  | **Cross-phase integration**      | **9 tests** | **Critical integration scenarios**        |
| `VaultRedeemed.ts`            | Redeemed asset protection        | ~4 tests    | Security validation                       |
| `VaultDirectTransfer.ts`      | Direct transfer handling         | ~6 tests    | Emergency admin functions                 |
| `VaultCoverageGapsFixed.ts`   | Edge cases and coverage          | ~15 tests   | Comprehensive coverage gaps               |

### Supporting Files

- `AstaVerde.fixture.ts` - Shared test fixtures and utilities
- `lib.ts` - Common test helper functions
- `types.ts` - TypeScript type definitions for tests
- `HelperTest.ts` - USDC minting utilities

## 🎯 Phase 1 Testing Strategy

### Dutch Auction Mechanism

```typescript
// Price decay testing
it("Should decrease batch price daily from creation", async () => {
    // Tests 1 USDC daily price reduction from 230 USDC base to 40 USDC floor
});

// Base price adjustments
it("Should increase basePrice by 10 USDC for quick sales", async () => {
    // Tests dynamic pricing based on market demand
});
```

### Key Test Scenarios

- **Batch Creation & Management**: Minting, validation, size limits
- **Dynamic Pricing**: Dutch auction, base price adjustments, floor enforcement
- **Revenue Distribution**: 70% producer, 30% platform split
- **Token Redemption**: Ownership validation, state management
- **Admin Functions**: Platform funds, parameter adjustments

### Critical Edge Cases

- Batch size validation (max 100 tokens)
- Price floor enforcement (40 USDC minimum)
- Time-based price calculations with block timestamp manipulation
- Producer payment distribution accuracy

## 🏦 Phase 2 Testing Strategy

### Vault Core Functions

```typescript
// Fixed-rate loan testing
it("Should allow deposit of un-redeemed NFT and mint SCC", async () => {
    // Verifies 1 NFT → 20 SCC fixed rate
    expect(sccBalance).to.equal(ethers.parseEther("20"));
});

// Exact NFT return
it("Should return exact NFT on withdrawal", async () => {
    // Tests non-fungible CDP model - users get their specific NFT back
});
```

### Security Model Validation

- **Redeemed Asset Protection**: `require(!redeemed, "redeemed asset")`
- **Access Control**: `onlyOwner` admin functions, role-based permissions
- **Reentrancy Protection**: `nonReentrant` modifier testing
- **Pause Functionality**: Emergency stop mechanisms

### Gas Optimization Testing

- **Deposit Gas Target**: < 165k (actual: ~152k) ✅
- **Withdraw Gas Target**: < 120k (actual: ~75k) ✅
- **Efficiency Verification**: All operations within production limits

## 🔗 Integration Testing (Phase 1↔2)

### IntegrationPhase1Phase2.ts - Critical Scenarios

#### 1. Dutch Auction Price Integration

```typescript
it("should accept vault deposits regardless of NFT purchase price", async () => {
    // User1: Buys at 230 USDC → Gets 20 SCC
    // User2: Buys at 40 USDC (floor) → Gets 20 SCC
    // Validates economic model consistency
});
```

#### 2. Base Price Adjustment Impact

```typescript
it("should maintain vault loans when basePrice increases", async () => {
    // Tests vault stability during market price changes
    // Existing loans unaffected by base price adjustments
});
```

#### 3. Producer Revenue Integration

```typescript
it("should maintain producer revenue flow when NFTs move through vault", async () => {
    // Ensures vault doesn't interfere with marketplace economics
    // Producer gets paid on sale, vault operations don't trigger double payments
});
```

#### 4. Time-Based State Synchronization

```typescript
it("should maintain consistent state across time-dependent operations", async () => {
    // Dutch auction timing + vault operations
    // 7-day time advancement with price verification
});
```

#### 5. Emergency State Integration

```typescript
it("should handle paused vault with active marketplace", async () => {
    // Independent operation validation
    // Marketplace works when vault is paused
});
```

## 🧪 Test Utilities & Helpers

### Time Manipulation

```typescript
async function advanceTimeByDays(days: number) {
    const secondsToAdvance = days * 24 * 60 * 60;
    await ethers.provider.send("evm_increaseTime", [secondsToAdvance]);
    await ethers.provider.send("evm_mine", []);
}
```

### Marketplace Purchase Helper

```typescript
async function buyNFTFromMarketplace(astaVerde, mockUSDC, user, batchId, quantity = 1) {
    const batchPrice = await astaVerde.getCurrentBatchPrice(batchId);
    const totalCost = batchPrice * BigInt(quantity);
    await mockUSDC.connect(user).approve(astaVerde.target, totalCost);
    await astaVerde.connect(user).buyBatch(batchId, totalCost, quantity);
    return { batchPrice, totalCost };
}
```

## 🔍 Coverage Analysis

### High Coverage Areas (>90%)

- **StabilizedCarbonCoin**: 100% statement coverage
- **EcoStabilizer**: 100% statement coverage
- **Core marketplace functions**: 89.84% statement coverage

### Areas for Future Enhancement

- **AstaVerde branch coverage**: 62.32% (complex pricing logic)
- **Edge case scenarios**: Extreme market conditions
- **Multi-user concurrent operations**: Race condition testing

## 🚀 Running Tests

### Full Test Suite

```bash
npm run test                 # Run all 109 tests
npm run coverage            # Generate coverage report
npm run test -- --grep "Integration"  # Run only integration tests
```

### Specific Test Categories

```bash
# Phase 1 marketplace tests
npx hardhat test test/AstaVerde.logic.behavior.ts

# Phase 2 vault tests
npx hardhat test test/EcoStabilizer.ts

# Critical integration tests
npx hardhat test test/IntegrationPhase1Phase2.ts

# Security-focused tests
npx hardhat test test/VaultRedeemed.ts test/VaultDirectTransfer.ts
```

### Development Workflow

```bash
npm run watch               # Auto-compile and test on contract changes
npm run lint               # Code quality checks
npm run prettier:write     # Format code
```

## 📋 Pre-Deployment Checklist

Before deploying to production, ensure:

- [ ] All 109 tests pass
- [ ] Coverage > 90% statements
- [ ] Gas targets met (Deposit <165k, Withdraw <120k)
- [ ] Integration tests validate Phase 1↔2 compatibility
- [ ] Security tests verify redeemed asset protection
- [ ] Time-based tests confirm pricing accuracy
- [ ] Admin function tests verify access control

## 🔗 Related Documentation

- `INTEGRATION_TESTING.md` - Detailed Phase 1↔2 integration analysis
- `README.md` - Test suite overview and execution guide
- `../SSC_PLAN.md` - Implementation specification
- `../CLAUDE.md` - Development commands and architecture

## 💡 Testing Philosophy

Our testing approach prioritizes:

1. **Economic Model Validation**: Fixed 20 SCC loans regardless of NFT purchase price
2. **Security First**: Redeemed asset rejection, access control, reentrancy protection
3. **Integration Confidence**: Comprehensive Phase 1↔2 interaction testing
4. **Production Readiness**: Gas optimization, real-world scenario simulation
5. **Maintainability**: Clear test structure, comprehensive coverage, documentation

The test suite provides **high confidence** that the EcoStabilizer vault system will work seamlessly with the existing AstaVerde marketplace on Base mainnet.
