# Ticket: Validate Token Existence in redeemToken

- Component: `contracts/AstaVerde.sol`
- Severity: Low
- Type: Defensive Enhancement

## Background / Justification

`redeemToken` currently checks balance and redemption status but not that the token exists in `tokens`. Adding an existence check prevents accidental marking of non-existent tokens as redeemed. Separately, redeemed tokens remain transferable; that resale risk is covered by `fix-astaverde-redeemed-nft-resale.md`.

## Tasks

1. Add existence check in `redeemToken`:
    ```solidity
    function redeemToken(uint256 tokenId) external nonReentrant {
        TokenInfo storage token = tokens[tokenId];
        require(token.tokenId != 0, "Token does not exist");
        require(balanceOf(msg.sender, tokenId) > 0, "Caller is not the token owner");
        require(!token.redeemed, "Token already redeemed");
        token.redeemed = true;
        emit TokenRedeemed(tokenId, msg.sender, block.timestamp);
    }
    ```
2. Alternatively, `require(tokenId <= lastTokenID)`.
3. Update tests accordingly.

## Acceptance Criteria

- Cannot redeem tokenIds never minted; valid tokens redeem as usual.

## Notes

- Redeemed token transfer/resale prevention is handled by `fix-astaverde-redeemed-nft-resale.md`.
