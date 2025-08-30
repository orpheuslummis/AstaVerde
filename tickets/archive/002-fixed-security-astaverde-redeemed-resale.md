# Fix AstaVerde Redeemed NFT Resale Vulnerability

## Priority: HIGH

- **Status: ✅ FIXED**
- **Last Checked: 2025-08-13**

## ⚠️ CURRENT STATUS

**STILL VULNERABLE**: The contract does not check redemption status when selecting tokens for sale:

- Line 357 in `getPartialIds`: Only checks `balanceOf(address(this), tokenId) > 0`
- Missing check: `&& !tokens[tokenId].redeemed`
- **Attack Vector**: User can transfer redeemed NFT back to contract, it will be resold to unsuspecting buyers

## Issue

A redeemed token (`TokenInfo.redeemed == true`) can still be transferred because the contract does not block transfers of redeemed tokens. Additionally, as an `ERC1155Holder`, the contract will accept unsolicited transfers, making it possible for redeemed tokens to end up back in the contract's balance and be resold if selection logic is naive.

## Location

- Contract: `AstaVerde.sol`
- Inheritance: line 12 - `ERC1155Holder`
- Function: `getPartialIds()` lines 349-365
- Impact: `buyBatch()` could sell already-redeemed tokens

## Vulnerability Details

```solidity
// Contract accepts any ERC1155 transfers
contract AstaVerde is ERC1155, ERC1155Pausable, ERC1155Holder, Ownable, ReentrancyGuard {

// Selection only checks balance, not redemption status
function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
    // ...
    if (balanceOf(address(this), tokenId) > 0) {  // Missing: && !tokens[tokenId].redeemed
        partialIds[counter] = tokenId;
        counter++;
    }
    // ...
}
```

## Attack Scenario

1. User buys NFT tokenId=100 from batch
2. User redeems NFT (marked as redeemed, transferred to user)
3. User transfers redeemed NFT back to AstaVerde contract
4. Contract balance shows tokenId=100 available
5. Another user calls `buyBatch()` and receives already-redeemed NFT
6. New buyer cannot redeem (already redeemed), loses money

## Impact

- **Severity**: High
- **Risk**: Users purchasing worthless redeemed NFTs
- **Financial Impact**: Full purchase price per redeemed token
- **Trust Impact**: Marketplace credibility damage

## Recommended Fix

### Option 1: Hard-block transfers of redeemed tokens

Block any transfer of a redeemed token in the ERC1155 transfer hook. This makes redeemed tokens non-transferable regardless of balance location.

```solidity
function _update(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory values
) internal override(ERC1155, ERC1155Pausable) {
    if (from != address(0)) {
        for (uint256 i = 0; i < ids.length; i++) {
            require(!tokens[ids[i]].redeemed, "redeemed non-transferable");
        }
    }
    super._update(from, to, ids, values);
}
```

Pros: Simple, enforces invariant everywhere. Cons: Prevents secondary transfer after redemption (intended).

### Option 2: Burn on redeem

```solidity
function redeemToken(uint256 tokenId) external nonReentrant {
    TokenInfo storage token = tokens[tokenId];
    require(token.tokenId != 0, "Token does not exist");
    require(balanceOf(msg.sender, tokenId) > 0, "not owner");
    require(!token.redeemed, "already redeemed");
    token.redeemed = true;
    _burn(msg.sender, tokenId, 1);
    emit TokenRedeemed(tokenId, msg.sender, block.timestamp);
}
```

Pros: Makes resale impossible; simplest mental model. Cons: Update any logic that relied on post-redeem balances.

### Option 3: Exclude Redeemed Tokens During Selection

### Option 1: Exclude Redeemed Tokens in Selection

```solidity
function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
    uint256[] memory partialIds = new uint256[](numberToBuy);
    uint256 counter = 0;

    for (uint256 i = 0; i < maxBatchSize && counter < numberToBuy; i++) {
        uint256 tokenId = batchID * maxBatchSize + i;
        // Check both balance AND redemption status
        if (balanceOf(address(this), tokenId) > 0 && !tokens[tokenId].redeemed) {
            partialIds[counter] = tokenId;
            counter++;
        }
    }

    require(counter == numberToBuy, "Not enough tokens available");
    return partialIds;
}
```

### Option 4: Reject Unsolicited Transfers (optional)

```solidity
// Track legitimate incoming transfers
bool private _expectingTransfer;

function onERC1155Received(
    address operator,
    address from,
    uint256 id,
    uint256 value,
    bytes memory data
) public virtual override returns (bytes4) {
    // Only accept transfers we initiated (minting or returns)
    require(_expectingTransfer || from == address(0), "Unsolicited transfer rejected");
    return super.onERC1155Received(operator, from, id, value, data);
}

function mintBatch(...) external onlyOwner {
    _expectingTransfer = true;
    // ... minting logic ...
    _expectingTransfer = false;
}
```

### Option 5: Separate Inventory Tracking (optional)

```solidity
mapping(uint256 => bool) public availableForSale;

function mintBatch(...) external onlyOwner {
    // ... existing minting ...
    for (uint256 i = 0; i < numberOfTokens; i++) {
        availableForSale[tokenId] = true;
    }
}

function buyBatch(...) external {
    // ... existing logic ...
    for (uint256 i = 0; i < tokenIds.length; i++) {
        availableForSale[tokenIds[i]] = false;
    }
}

function getPartialIds(...) internal view returns (uint256[] memory) {
    // Check availableForSale instead of just balance
    if (availableForSale[tokenId] && balanceOf(address(this), tokenId) > 0) {
        // ...
    }
}
```

## Testing Requirements

1. Test transferring redeemed NFT back to contract
2. Verify redeemed NFTs cannot be transferred (Option 1/2) or selected for sale (Option 3)
3. Test batch operations with mixed redeemed/unredeemed tokens
4. Verify legitimate transfers (minting) still work
5. Gas usage remains acceptable

## Acceptance Criteria

- [ ] Redeemed NFTs cannot be transferred or resold
- [ ] Legitimate minting and sales operations unaffected
- [ ] Clear error messages for rejected transfers
- [ ] All existing tests pass
- [ ] New tests cover edge cases

## References

- ERC1155Holder vulnerability patterns
- Similar issue: OpenSea redeemed NFT resale bug
- Best practice: Explicit inventory management

## Notes

This vulnerability allows selling worthless redeemed NFTs to unsuspecting buyers. Critical to fix before mainnet as it directly impacts user funds and marketplace integrity.
