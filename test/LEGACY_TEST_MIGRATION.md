# Legacy Test Migration Guide

## Overview
The AstaVerde contract has been updated to use a **pull payment pattern** instead of direct transfers to producers. This prevents DoS attacks but requires updating tests that expect the old behavior.

## Quick Migration Patterns

### Pattern 1: Direct Balance Check → Accrued Balance Check

**Old Pattern:**
```typescript
await astaVerde.buyBatch(1, price, 1);
const producerBalance = await mockUSDC.balanceOf(producer);
expect(producerBalance).to.equal(expectedAmount);
```

**New Pattern:**
```typescript
await astaVerde.buyBatch(1, price, 1);
const producerBalance = await astaVerde.producerBalances(producer);
expect(producerBalance).to.equal(expectedAmount);
// Optional: Test actual claim
await astaVerde.connect(producer).claimProducerFunds();
const usdcBalance = await mockUSDC.balanceOf(producer);
expect(usdcBalance).to.equal(expectedAmount);
```

### Pattern 2: Balance Change Expectations

**Old Pattern:**
```typescript
const balanceBefore = await mockUSDC.balanceOf(producer);
await astaVerde.buyBatch(1, price, 1);
const balanceAfter = await mockUSDC.balanceOf(producer);
expect(balanceAfter - balanceBefore).to.equal(producerShare);
```

**New Pattern:**
```typescript
const accruedBefore = await astaVerde.producerBalances(producer);
await astaVerde.buyBatch(1, price, 1);
const accruedAfter = await astaVerde.producerBalances(producer);
expect(accruedAfter - accruedBefore).to.equal(producerShare);
```

### Pattern 3: Multiple Producer Payments

**Old Pattern:**
```typescript
await astaVerde.buyBatch(1, totalPrice, tokenCount);
for (const producer of producers) {
  const balance = await mockUSDC.balanceOf(producer);
  expect(balance).to.equal(expectedShares[producer]);
}
```

**New Pattern:**
```typescript
await astaVerde.buyBatch(1, totalPrice, tokenCount);
for (const producer of producers) {
  const accrued = await astaVerde.producerBalances(producer);
  expect(accrued).to.equal(expectedShares[producer]);
}
// Optional: Test claims
for (const producer of producers) {
  await astaVerde.connect(producer).claimProducerFunds();
}
```

### Pattern 4: Emergency Rescue Function (Removed)

**Old Pattern:**
```typescript
await astaVerde.connect(owner).emergencyRescue();
```

**New Pattern:**
```typescript
// emergencyRescue has been removed
// Use pause() for emergency situations
await astaVerde.connect(owner).pause();
// Producers can still claim during pause
await astaVerde.connect(producer).claimProducerFunds();
```

## Using Helper Functions

Import the helper module:
```typescript
import {
  expectProducerBalance,
  claimAndVerifyProducerFunds,
  verifyProducerPaymentFlow,
  verifyAccountingInvariant
} from './helpers/pullPaymentHelpers';
```

Example usage:
```typescript
// Verify accrued balance
await expectProducerBalance(astaVerde, producer, expectedAmount);

// Claim and verify
await claimAndVerifyProducerFunds(astaVerde, mockUSDC, producer);

// Full flow test
await verifyProducerPaymentFlow(
  astaVerde, mockUSDC, buyer, producer, 
  batchId, tokenAmount
);
```

## Files Requiring Updates

1. **test/AstaVerde.ts** - Main test file
   - Producer payout tests
   - Balance verification tests

2. **test/AstaVerde.v2.test.ts** - V2 specific tests
   - Multi-producer distribution tests
   - Rounding tests

3. **test/AstaVerde.security.test.ts** - Security tests
   - Emergency rescue tests (remove these)
   - Pause behavior tests

4. **test/IntegrationPhase1Phase2.ts** - Integration tests
   - Cross-contract payment flows
   - Vault interaction tests

5. **test/UserJourney.ts** - End-to-end tests
   - Complete user lifecycle tests
   - Multi-step purchase flows

## Test Update Checklist

- [ ] Replace `mockUSDC.balanceOf(producer)` checks with `astaVerde.producerBalances(producer)`
- [ ] Add `claimProducerFunds()` calls where USDC balance is needed
- [ ] Remove references to `emergencyRescue()` function
- [ ] Update event expectations (ProducerPayment → ProducerPaymentAccrued)
- [ ] Verify accounting invariants hold after changes
- [ ] Test that claims work correctly in all scenarios

## Common Gotchas

1. **Accumulated Balances**: Producers may have balances from multiple sales
2. **Claim Once**: Each claim zeros the balance, can't claim twice
3. **Pause Behavior**: Claims are allowed during pause (intentional)
4. **Event Changes**: Old `ProducerPayment` event replaced with `ProducerPaymentAccrued`
5. **Total Tracking**: Use `totalProducerBalances` for aggregate tracking