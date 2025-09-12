// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StabilizedCarbonCoin.sol";
import "./IAstaVerde.sol";

/**
 * @title EcoStabilizer - NFT Collateralization Vault for Carbon Offsets
 * @author AstaVerde Team
 * @notice Enables 1:1 collateralization of AstaVerde NFTs for fixed SCC loans
 * @dev Non-fungible CDP system with no liquidation risk and fixed issuance rate
 *
 * DEPLOYMENT:
 * - Deploy after AstaVerde (Phase 1) contract is live
 * - Deploy sequence: SCC token → EcoStabilizer → grant MINTER_ROLE → renounce admin
 * - SCC token address and AstaVerde address are immutable after deployment
 * - Owner should be a multisig wallet for production deployments
 *
 * KEY MECHANICS:
 * - Fixed rate: Each NFT collateralizes exactly 20 SCC (no oracles needed)
 * - No liquidations: Users always reclaim their original NFT upon repayment
 * - Non-fungible CDPs: Each NFT maintains unique identity through loan lifecycle
 * - Redeemed protection: Only un-redeemed carbon offsets accepted as collateral
 * - Pull pattern: Prevents DoS attacks during batch operations
 *
 * SECURITY:
 * - ReentrancyGuard on all state-changing functions
 * - Pausable for emergency situations
 * - Access control via Ownable for admin functions
 * - Indexed view functions for predictable gas on reads
 * - CEI (Checks-Effects-Interactions) pattern throughout
 *
 * GAS OPTIMIZATION:
 * - Batch operations save ~75% gas vs sequential calls
 * - Target gas usage: <150k for deposit, <120k for withdraw
 * - Indexed view functions and pagination for large datasets
 *
 * INTEGRATION:
 * - Works with existing AstaVerde ERC-1155 NFTs
 * - SCC minting exclusive to this vault (enforced by MINTER_ROLE)
 * - Price stability through arbitrage with AstaVerde primary market
 */
contract EcoStabilizer is ERC1155Holder, ReentrancyGuard, Pausable, Ownable {
    /** CONSTANTS **/
    /// @notice Fixed SCC issuance rate per NFT collateral (20 SCC with 18 decimals)
    /// @dev Eliminates oracle dependency by using fixed collateralization ratio
    uint256 public constant SCC_PER_ASSET = 20 * 1e18; // 20 SCC, 18 decimals

    /// @notice Maximum items per paginated query to ensure bounded gas usage
    uint256 public constant MAX_PAGE_SIZE = 2000; // Maximum items per paginated query

    /** IMMUTABLES **/
    /// @notice Reference to the AstaVerde ERC-1155 contract for carbon offset NFTs
    /// @dev Set in constructor, cannot be changed after deployment
    IAstaVerde public immutable ecoAsset; // ERC1155 + token data

    /// @notice Reference to the SCC ERC-20 token contract
    /// @dev This vault must have exclusive MINTER_ROLE on the SCC contract
    StabilizedCarbonCoin public immutable scc;

    /** STATE **/
    /**
     * @notice Loan information for each collateralized NFT
     * @dev Tracks borrower address and active status for each tokenId
     * @param borrower The address that deposited the NFT and received SCC
     * @param active Whether the loan is currently active (NFT deposited, SCC not repaid)
     */
    struct Loan {
        address borrower;
        bool active;
    }

    /// @notice Mapping from token ID to loan information
    /// @dev tokenId → Loan structure containing borrower and status
    mapping(uint256 => Loan) public loans; // tokenId → Loan

    /** INDEXED STATE **/
    /// @notice Per-user list of active loan token IDs
    mapping(address => uint256[]) private userLoanIds;
    /// @notice Index of token ID in a user's loan list (for O(1) removals)
    mapping(address => mapping(uint256 => uint256)) private userLoanIndex;
    /// @notice Total number of active loans across all users
    uint256 public totalActiveLoans;

    /** EVENTS **/
    /// @notice Emitted when a user deposits an NFT and receives SCC
    /// @param user The address depositing the NFT
    /// @param tokenId The ID of the deposited NFT
    event Deposited(address indexed user, uint256 indexed tokenId);

    /// @notice Emitted when a user repays SCC and withdraws their NFT
    /// @param user The address withdrawing the NFT
    /// @param tokenId The ID of the withdrawn NFT
    event Withdrawn(address indexed user, uint256 indexed tokenId);

    /// @notice Emitted when admin sweeps an unsolicited NFT
    /// @param to The address receiving the swept NFT
    /// @param tokenId The ID of the swept NFT
    event EmergencyNFTWithdrawn(address indexed to, uint256 indexed tokenId);

    // No additional events required for indexing

    /**
     * @notice Initialize the EcoStabilizer vault
     * @dev Sets immutable references to AstaVerde and SCC contracts
     * @param _ecoAsset Address of the AstaVerde ERC-1155 contract
     * @param _scc Address of the StabilizedCarbonCoin ERC-20 contract
     */
    constructor(address _ecoAsset, address _scc) Ownable(msg.sender) {
        require(_ecoAsset != address(0), "invalid ecoAsset");
        require(_scc != address(0), "invalid scc");
        ecoAsset = IAstaVerde(_ecoAsset);
        scc = StabilizedCarbonCoin(_scc);
    }

    /*────────────────────────  INTERNAL: INDEX HELPERS  ────────────*/
    function _addToUserIndex(address user, uint256 tokenId) internal {
        userLoanIndex[user][tokenId] = userLoanIds[user].length;
        userLoanIds[user].push(tokenId);
    }

    function _removeFromUserIndex(address user, uint256 tokenId) internal {
        uint256 idx = userLoanIndex[user][tokenId];
        uint256 lastIdx = userLoanIds[user].length - 1;
        if (idx != lastIdx) {
            uint256 moved = userLoanIds[user][lastIdx];
            userLoanIds[user][idx] = moved;
            userLoanIndex[user][moved] = idx;
        }
        userLoanIds[user].pop();
        delete userLoanIndex[user][tokenId];
    }

    /*────────────────────────  CORE FUNCTIONS  ───────────────────────*/

    /**
     * @notice Deposit an AstaVerde NFT as collateral and receive 20 SCC
     * @dev Implements CEI pattern, checks redemption status, mints fixed SCC amount
     *
     * Requirements:
     * - Token must not have an active loan
     * - Caller must own the NFT
     * - NFT must not be redeemed (real-world carbon offset not claimed)
     * - Contract must not be paused
     *
     * @param tokenId The ID of the AstaVerde NFT to deposit
     */
    function deposit(uint256 tokenId) external nonReentrant whenNotPaused {
        require(!loans[tokenId].active, "loan active");
        require(ecoAsset.balanceOf(msg.sender, tokenId) > 0, "not token owner");
        require(!ecoAsset.isRedeemed(tokenId), "redeemed asset");

        // Update state first (CEI pattern)
        loans[tokenId] = Loan(msg.sender, true);
        _addToUserIndex(msg.sender, tokenId);
        totalActiveLoans += 1;

        // External interactions after state changes
        ecoAsset.safeTransferFrom(msg.sender, address(this), tokenId, 1, "");
        scc.mint(msg.sender, SCC_PER_ASSET);

        emit Deposited(msg.sender, tokenId);
    }

    /**
     * @notice Repay 20 SCC and withdraw your collateralized NFT
     * @dev Burns SCC from caller and returns the exact NFT originally deposited
     *
     * Requirements:
     * - Caller must be the original borrower
     * - Loan must be active
     * - Caller must have 20 SCC balance
     * - Contract must not be paused
     *
     * @param tokenId The ID of the NFT to withdraw
     */
    function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        _withdrawInternal(tokenId);
    }

    /**
     * @notice Internal withdraw logic used by both single and batch operations
     * @dev Separated to avoid code duplication while maintaining security
     * @param tokenId The ID of the NFT to withdraw
     */
    function _withdrawInternal(uint256 tokenId) internal {
        Loan memory loan = loans[tokenId];
        require(loan.active && loan.borrower == msg.sender, "not borrower");

        // Update state first (CEI pattern)
        _removeFromUserIndex(loan.borrower, tokenId);
        totalActiveLoans -= 1;
        delete loans[tokenId];

        // Collect repayment then return collateral
        scc.transferFrom(msg.sender, address(this), SCC_PER_ASSET);
        scc.burn(SCC_PER_ASSET);
        ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

        emit Withdrawn(msg.sender, tokenId);
    }

    /*────────────────────────  ADMIN  ───────────────────────────────*/

    /**
     * @notice Pause all deposits and withdrawals
     * @dev Only callable by owner, typically for emergency situations
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Resume deposits and withdrawals after pause
     * @dev Only callable by owner after addressing pause reason
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // Removed: maxScanRange configuration and event; no longer needed with indices

    /**
     * @notice Recover unsolicited NFTs sent to the vault
     * @dev Only for NFTs without active loans (prevents stealing collateral)
     *
     * Use cases:
     * - User accidentally sends NFT directly to vault
     * - Cleanup of test/abandoned NFTs
     * - Recovery from failed transactions
     *
     * @param tokenId The ID of the NFT to sweep
     * @param to The address to send the NFT to
     */
    function adminSweepNFT(uint256 tokenId, address to) external onlyOwner {
        require(!loans[tokenId].active, "loan active");
        require(to != address(0), "invalid address");
        ecoAsset.safeTransferFrom(address(this), to, tokenId, 1, "");
        emit EmergencyNFTWithdrawn(to, tokenId);
    }

    /*────────────────────────  VIEW FUNCTIONS  ─────────────────────*/
    /// @notice Get user's active loans (O(k) copy from indexed storage)
    function getUserLoans(address user) external view returns (uint256[] memory out) {
        uint256 len = userLoanIds[user].length;
        out = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            out[i] = userLoanIds[user][i];
        }
    }

    /// @notice Get total count of active loans across all users (O(1))
    function getTotalActiveLoans() external view returns (uint256) {
        return totalActiveLoans;
    }

    /// @notice Get user's loan count (O(1))
    function getUserLoanCount(address user) external view returns (uint256) {
        return userLoanIds[user].length;
    }

    /*────────────────────  BATCH OPERATIONS  ──────────────────────*/

    /**
     * @notice Deposit multiple NFTs in a single transaction
     * @param tokenIds Array of token IDs to deposit
     * @dev Gas efficient batch operation (saves ~75% gas vs sequential deposits)
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
            require(!ecoAsset.isRedeemed(tokenId), "redeemed asset");

            // Record the loan
            loans[tokenId] = Loan({borrower: msg.sender, active: true});
            _addToUserIndex(msg.sender, tokenId);
            totalActiveLoans += 1;

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

            // Clear the loan via index removal and delete
            _removeFromUserIndex(msg.sender, tokenId);
            totalActiveLoans -= 1;
            delete loans[tokenId];

            emit Withdrawn(msg.sender, tokenId);
        }

        // Collect repayment then burn all SCC at once
        scc.transferFrom(msg.sender, address(this), totalSCC);
        scc.burn(totalSCC);

        // Transfer all NFTs back in one batch call
        uint256[] memory amounts = new uint256[](tokenIds.length);
        for (uint256 i = 0; i < tokenIds.length; i++) {
            amounts[i] = 1;
        }
        ecoAsset.safeBatchTransferFrom(address(this), msg.sender, tokenIds, amounts, "");
    }

    /*────────────────────  INDEXED VIEW FUNCTIONS  ───────────────*/
    /// @notice Get user's active loans with offset/limit over indexed storage
    /// @return tokenIds Slice of user's active loan IDs
    /// @return nextOffset Next offset to continue from (0 if end reached)
    function getUserLoansIndexed(
        address user,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory tokenIds, uint256 nextOffset) {
        require(limit > 0 && limit <= MAX_PAGE_SIZE, "invalid limit");
        uint256 len = userLoanIds[user].length;
        if (offset >= len) {
            return (new uint256[](0), 0);
        }
        uint256 end = offset + limit;
        if (end > len) {
            end = len;
        }
        uint256 size = end - offset;
        tokenIds = new uint256[](size);
        for (uint256 i = 0; i < size; i++) {
            tokenIds[i] = userLoanIds[user][offset + i];
        }
        nextOffset = end < len ? end : 0;
    }
}
