// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./EcoStabilizer.sol";

/**
 * @title EcoStabilizerV2
 * @notice Extends EcoStabilizer with batch operations for gas efficiency
 */
contract EcoStabilizerV2 is EcoStabilizer {
    constructor(address _ecoAsset, address _scc) EcoStabilizer(_ecoAsset, _scc) {}

    /**
     * @notice Deposit multiple NFTs in a single transaction
     * @param tokenIds Array of token IDs to deposit
     * @dev Gas efficient batch operation
     */
    function depositBatch(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        require(tokenIds.length > 0, "empty array");
        require(tokenIds.length <= 20, "too many tokens"); // Reasonable limit to prevent gas issues

        uint256 totalSCC = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Check each token
            require(!loans[tokenId].active, "loan active");
            require(ecoAsset.balanceOf(msg.sender, tokenId) > 0, "not token owner");
            (, , , , bool redeemed) = ecoAsset.tokens(tokenId);
            require(!redeemed, "redeemed asset");

            // Record the loan
            loans[tokenId] = Loan({borrower: msg.sender, active: true});

            totalSCC += SCC_PER_ASSET;

            emit Deposited(msg.sender, tokenId);
        }

        // Transfer all NFTs in one batch call
        uint256[] memory amounts = new uint256[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            amounts[i] = 1;
        }
        ecoAsset.safeBatchTransferFrom(msg.sender, address(this), tokenIds, amounts, "");

        // Mint all SCC at once
        scc.mint(msg.sender, totalSCC);
    }

    /**
     * @notice Withdraw multiple NFTs in a single transaction
     * @param tokenIds Array of token IDs to withdraw
     * @dev Requires sufficient SCC balance for all withdrawals
     */
    function withdrawBatch(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        require(tokenIds.length > 0, "empty array");
        require(tokenIds.length <= 20, "too many tokens");

        uint256 totalSCC = tokenIds.length * SCC_PER_ASSET;

        // Check SCC balance upfront
        require(scc.balanceOf(msg.sender) >= totalSCC, "insufficient SCC");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];

            // Verify ownership of each loan
            require(loans[tokenId].active, "loan not active");
            require(loans[tokenId].borrower == msg.sender, "not borrower");

            // Clear the loan
            delete loans[tokenId];

            emit Withdrawn(msg.sender, tokenId);
        }

        // Burn all SCC at once
        scc.burnFrom(msg.sender, totalSCC);

        // Transfer all NFTs back in one batch call
        uint256[] memory amounts = new uint256[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            amounts[i] = 1;
        }
        ecoAsset.safeBatchTransferFrom(address(this), msg.sender, tokenIds, amounts, "");
    }
}
