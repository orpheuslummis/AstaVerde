// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

/**
 * @title IAstaVerde Interface
 * @dev Extends IERC1155 to provide access to AstaVerde-specific functions needed by EcoStabilizer vault
 *
 * This interface enables the vault contract to:
 * - Check redemption status via isRedeemed() for vault collateral validation
 * - Verify NFTs haven't been redeemed before accepting as collateral
 * - Handle standard ERC1155 transfers for vault deposits/withdrawals
 * - Get the latest token ID for validation purposes
 *
 * The vault requires redemption status checks because only un-redeemed EcoAssets
 * can be deposited as collateral per Phase 2 specifications.
 *
 * Note: The tokens() function remains available for external tools and testing
 * that need comprehensive token metadata.
 */
interface IAstaVerde is IERC1155 {
    /**
     * @notice Get comprehensive token information
     * @param tokenId The ID of the token to query
     * @return originalMinter Address that minted the token (always the owner/multisig) - NOT CURRENT HOLDER
     * @return tokenId Token ID (mirrors input parameter)
     * @return producer Original producer/creator of the carbon offset
     * @return cid IPFS content identifier for token metadata
     * @return redeemed Whether this carbon offset has been redeemed/retired
     * @dev WARNING: The 'originalMinter' field is set at mint and never updated. For current ownership, use balanceOf()
     */
    function tokens(
        uint256
    )
        external
        view
        returns (address originalMinter, uint256 tokenId, address producer, string memory cid, bool redeemed);

    /**
     * @notice Get the most recently minted token ID
     * @return The highest token ID that has been minted
     */
    function lastTokenID() external view returns (uint256);

    /**
     * @notice Check if a token has been redeemed
     * @param tokenId The ID of the token to check
     * @return Whether the token has been redeemed
     * @dev Provides a stable interface that doesn't depend on internal struct layout
     */
    function isRedeemed(uint256 tokenId) external view returns (bool);
}
