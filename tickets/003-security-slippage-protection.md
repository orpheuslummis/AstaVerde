# Security: Slippage Protection for buyBatch

**Priority**: HIGH  
**Type**: Security Enhancement  
**Status**: Open  
**Component**: AstaVerde.sol  
**Security Impact**: Medium - Prevents MEV/front-running losses  

## Summary
The `buyBatch` function is vulnerable to front-running attacks where MEV bots can manipulate transaction ordering to cause users to pay more than expected. Adding a `maxPrice` parameter would protect users from price increases between transaction submission and execution.

## Current Issue
```solidity
function buyBatch(uint256 batchID, uint256 usdcAmount, uint256 tokenAmount) external
```
- No protection against price changes
- No deadline protection for transactions in mempool
- MEV bots can front-run to trigger price increases  
- Users may pay significantly more than expected
- Transactions sitting in mempool for days execute at stale prices
- Poor UX during network congestion

## Proposed Solution
Add both `maxPricePerToken` and `deadline` parameters for comprehensive protection.

### Implementation

```solidity
function buyBatch(
    uint256 batchID, 
    uint256 usdcAmount, 
    uint256 tokenAmount,
    uint256 maxPricePerToken,  // Price protection
    uint256 deadline           // Time protection
) external whenNotPaused nonReentrant {
    require(block.timestamp <= deadline, "Transaction expired");
    require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
    Batch storage batch = batches[batchID - 1];
    require(batch.creationTime > 0, "Batch not initialized");
    require(tokenAmount > 0, "Invalid token amount");
    require(tokenAmount <= batch.remainingTokens, "Not enough tokens in batch");

    uint256 currentPrice = getCurrentBatchPrice(batchID);
    
    // Slippage protection
    require(currentPrice <= maxPricePerToken, "Price exceeds maximum");
    
    uint256 totalCost = currentPrice * tokenAmount;
    require(usdcAmount >= totalCost, "Insufficient funds sent");
    
    // ... rest of function
}
```

### Alternative: Percentage-based slippage
```solidity
function buyBatch(
    uint256 batchID,
    uint256 usdcAmount,
    uint256 tokenAmount,
    uint256 maxSlippageBps  // Basis points (100 = 1%)
) external {
    uint256 expectedPrice = getCurrentBatchPrice(batchID);
    uint256 maxPrice = expectedPrice * (10000 + maxSlippageBps) / 10000;
    require(currentPrice <= maxPrice, "Price exceeds slippage tolerance");
}
```

## Benefits
- Protects users from unexpected price increases
- Prevents MEV extraction
- Improves user experience and trust
- Standard DeFi best practice

## Migration Strategy
1. Add new function `buyBatchWithSlippage` first
2. Deprecate old `buyBatch` after transition period
3. Update frontend to use new function

## Testing Requirements
- [ ] Test normal purchases within slippage
- [ ] Test rejection when price exceeds maximum
- [ ] Test transaction expiry after deadline
- [ ] Test edge case where price equals maxPrice exactly
- [ ] Test with various slippage tolerances
- [ ] Gas cost comparison

## Acceptance Criteria
- [ ] Slippage protection parameter added (maxPrice)
- [ ] Deadline protection parameter added
- [ ] Transactions revert if executed after deadline
- [ ] Transactions revert if current price exceeds maxPrice
- [ ] Existing tests updated
- [ ] Frontend provides sensible defaults (e.g., deadline = current + 30 minutes)
- [ ] Frontend integration completed
- [ ] Documentation updated

## Affected Files
- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts`
- `webapp/src/hooks/useContractInteraction.ts`