# Ticket #101: CRITICAL - Partial Batch Purchase Bug with Redeemed Tokens

## Priority: HIGH

## Component: AstaVerde.sol

## Issue Type: Logic Bug

## Description
The `getPartialIds()` function in AstaVerde.sol has a critical bug when handling partial batch purchases that contain redeemed tokens. The function checks if tokens are not redeemed (`!tokens[tokenId].redeemed`) at line 564, but redeemed tokens can still be transferred and sold according to the contract design.

## Location
- File: `contracts/AstaVerde.sol`
- Function: `getPartialIds()`
- Lines: 555-572

## Current Code
```solidity
function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
    // ...
    for (uint256 i = 0; i < batches[batchID - 1].tokenIds.length && counter < numberToBuy; i++) {
        uint256 tokenId = batches[batchID - 1].tokenIds[i];
        // Check both balance AND that token is not redeemed
        if (balanceOf(address(this), tokenId) > 0 && !tokens[tokenId].redeemed) {
            partialIds[counter] = tokenId;
            counter++;
        }
    }
    // ...
}
```

## Problem
1. The function skips redeemed tokens when collecting IDs for partial purchases
2. But redeemed tokens are still tradeable and should be sellable from batches
3. This causes the function to fail with "Unable to get the required number of tokens" even when enough tokens exist
4. Creates inconsistency: redeemed tokens can be transferred but not sold from batches

## Impact
- **User Experience**: Legitimate purchases fail when batches contain redeemed tokens
- **Economic**: Reduces liquidity by artificially blocking valid sales
- **Consistency**: Contradicts the design where redeemed tokens remain tradeable

## Reproduction Steps
1. Create a batch with 10 tokens
2. Have someone buy and redeem 5 tokens
3. Return those 5 redeemed tokens to the contract
4. Try to buy 10 tokens from the batch
5. Transaction fails even though 10 tokens are available

## Recommended Fix
Remove the redeemed check from `getPartialIds()`:

```solidity
function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
    require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
    require(numberToBuy > 0, "Number to buy must be greater than zero");
    uint256[] memory partialIds = new uint256[](numberToBuy);
    uint256 counter = 0;

    for (uint256 i = 0; i < batches[batchID - 1].tokenIds.length && counter < numberToBuy; i++) {
        uint256 tokenId = batches[batchID - 1].tokenIds[i];
        // Only check balance, not redemption status
        if (balanceOf(address(this), tokenId) > 0) {
            partialIds[counter] = tokenId;
            counter++;
        }
    }

    require(counter == numberToBuy, "Unable to get the required number of tokens");
    return partialIds;
}
```

## Alternative Considerations
If the intent is to prevent redeemed tokens from being sold:
1. This should be enforced consistently across all transfer mechanisms
2. Would require major redesign of the redemption system
3. Current design explicitly allows redeemed tokens to remain tradeable

## Testing Required
- Unit test: Partial batch purchase with mix of redeemed/unredeemed tokens
- Integration test: Full cycle of mint → sell → redeem → resell
- Edge case: All tokens in batch are redeemed but available

## References
- Line 584: `require(!token.redeemed, "Token already redeemed")` - Only prevents re-redemption
- Line 576-588: Redemption doesn't burn or lock tokens
- Contract design doc: "Redeemed tokens remain transferable for secondary markets"