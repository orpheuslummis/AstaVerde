# Ticket 107: CRITICAL - AstaVerde Price Decrease Bypass via Single Token Purchase

## Status: OPEN

## Severity: CRITICAL

## Component: contracts/AstaVerde.sol

## Function: updateBasePrice()

## Issue Description

An attacker can prevent base price decreases indefinitely by purchasing a single token from each batch. The vulnerability exists because the price decrease logic requires batches to be 100% unsold (`batch.remainingTokens == batch.tokenIds.length`) to be eligible for price decrease consideration.

## Vulnerability Details

**Location**: contracts/AstaVerde.sol:743

```solidity
if (
    batch.creationTime <= thresholdStartTime &&
    batch.remainingTokens == batch.tokenIds.length &&  // ← Vulnerability: requires 100% unsold
    !batchUsedInPriceDecrease[batch.batchId]
) {
    unsoldBatchCount++;
    batchUsedInPriceDecrease[batch.batchId] = true;
    emit BatchMarkedUsedInPriceDecrease(batch.batchId, block.timestamp);
}
```

## Attack Scenario

1. Attacker monitors for new batches approaching the `dayDecreaseThreshold` (4 days)
2. Before the threshold, attacker purchases 1 token from each eligible batch
3. Batches now have `remainingTokens < tokenIds.length` and are excluded from decrease logic
4. Base price never decreases despite low demand
5. Attack cost: minimal (1 token × current price per batch)

## Business Impact

- **Economic Manipulation**: Artificial price inflation with minimal capital
- **Market Dysfunction**: Price discovery mechanism fails to reflect true demand
- **User Trust**: Undermines protocol's automatic price adjustment promise
- **Protocol Sustainability**: May lead to permanently elevated prices deterring genuine buyers

## Recommended Fix

### Option 1: Percentage Threshold (Recommended)

```solidity
// Consider batches with ≥95% tokens remaining as eligible for price decrease
if (
    batch.creationTime <= thresholdStartTime &&
    (batch.remainingTokens * 100) / batch.tokenIds.length >= 95 &&  // ← 95% threshold
    !batchUsedInPriceDecrease[batch.batchId]
) {
    unsoldBatchCount++;
    // ...
}
```

### Option 2: Weighted Decrease

```solidity
// Weight the decrease by the percentage of unsold tokens
uint256 unsoldPercentage = (batch.remainingTokens * 100) / batch.tokenIds.length;
if (
    batch.creationTime <= thresholdStartTime &&
    unsoldPercentage >= 80 &&  // Only consider substantially unsold batches
    !batchUsedInPriceDecrease[batch.batchId]
) {
    // Apply weighted decrease based on unsold percentage
    uint256 weightedDecrease = (priceAdjustDelta * unsoldPercentage) / 100;
    // ...
}
```

### Option 3: Time-locked Eligibility

```solidity
// Mark batches as decrease-eligible based on state at threshold time
// Store eligibility snapshot to prevent manipulation after the fact
```

## Test Requirements

1. **Attack Simulation Test**
    - Create multiple batches
    - Simulate attacker buying 1 token from each
    - Verify price decrease is NOT prevented with fix
    - Verify price decrease IS prevented without fix

2. **Threshold Behavior Test**
    - Test with batches at various sold percentages (90%, 95%, 99% remaining)
    - Ensure reasonable decrease behavior

3. **Gas Cost Analysis**
    - Verify fix doesn't significantly increase gas costs
    - Ensure iteration limits still effective

## Implementation Checklist

- [ ] Implement percentage threshold check (95% recommended)
- [ ] Add test case for manipulation attempt
- [ ] Verify existing price adjustment tests still pass
- [ ] Test gas consumption remains acceptable
- [ ] Update documentation to reflect new behavior
- [ ] Consider adding event for threshold-based exclusions

## Related Issues

- #104: Price iteration DoS (same function, different issue)
- External audit finding: High severity economic vulnerability

## References

- Security review: "High (economic): Base-price decrease bypass via 1-token buys"
- Code comment acknowledges issue exists (line 743)
- Similar vulnerability class: Governance quorum manipulation

## Priority Justification

**MUST FIX BEFORE MAINNET**: This vulnerability allows direct economic manipulation of the protocol's core pricing mechanism with minimal cost. It effectively breaks the automatic price discovery feature that is fundamental to the protocol's design.
