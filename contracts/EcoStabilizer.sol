// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./StabilizedCarbonCoin.sol";
import "./IAstaVerde.sol";

contract EcoStabilizer is ERC1155Holder, ReentrancyGuard, Pausable, Ownable {
    /** CONSTANTS **/
    uint256 public constant SCC_PER_ASSET = 20 * 1e18; // 20 SCC, 18 decimals
    uint256 public constant MAX_SCAN_CEILING = 50000; // Upper bound for maxScanRange to prevent DoS
    uint256 public constant MAX_PAGE_SIZE = 2000; // Maximum items per paginated query

    /** IMMUTABLES **/
    IAstaVerde public immutable ecoAsset; // ERC1155 + token data
    StabilizedCarbonCoin public immutable scc;

    /** STATE **/
    struct Loan {
        address borrower;
        bool active;
    }
    mapping(uint256 => Loan) public loans; // tokenId → Loan

    /** GAS LIMITS **/
    uint256 public maxScanRange = 10000; // Prevent gas bomb attacks on view functions

    /** EVENTS **/
    event Deposited(address indexed user, uint256 indexed tokenId);
    event Withdrawn(address indexed user, uint256 indexed tokenId);
    event EmergencyNFTWithdrawn(address indexed to, uint256 indexed tokenId);
    event MaxScanRangeUpdated(uint256 oldValue, uint256 newValue);

    constructor(address _ecoAsset, address _scc) Ownable(msg.sender) {
        require(_ecoAsset != address(0), "invalid ecoAsset");
        require(_scc != address(0), "invalid scc");
        ecoAsset = IAstaVerde(_ecoAsset);
        scc = StabilizedCarbonCoin(_scc);
    }

    /*────────────────────────  CORE FUNCTIONS  ───────────────────────*/
    function deposit(uint256 tokenId) external nonReentrant whenNotPaused {
        require(!loans[tokenId].active, "loan active");
        require(ecoAsset.balanceOf(msg.sender, tokenId) > 0, "not token owner");
        (, , , , bool redeemed) = ecoAsset.tokens(tokenId);
        require(!redeemed, "redeemed asset");

        // Update state first (CEI pattern)
        loans[tokenId] = Loan(msg.sender, true);

        // External interactions after state changes
        ecoAsset.safeTransferFrom(msg.sender, address(this), tokenId, 1, "");
        scc.mint(msg.sender, SCC_PER_ASSET);

        emit Deposited(msg.sender, tokenId);
    }

    function withdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        Loan memory loan = loans[tokenId];
        require(loan.active && loan.borrower == msg.sender, "not borrower");

        // Update state first (CEI pattern)
        loans[tokenId].active = false;

        // External interactions after state changes
        scc.burnFrom(msg.sender, SCC_PER_ASSET);
        ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

        emit Withdrawn(msg.sender, tokenId);
    }

    /// @notice Convenience function: identical to withdraw but with different name for UX
    /// @dev Still requires user to approve vault for 20 SCC spend before calling
    function repayAndWithdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        Loan memory loan = loans[tokenId];
        require(loan.active && loan.borrower == msg.sender, "not borrower");

        // Update state first (CEI pattern)
        loans[tokenId].active = false;

        // External interactions after state changes
        scc.burnFrom(msg.sender, SCC_PER_ASSET);
        ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");

        emit Withdrawn(msg.sender, tokenId);
    }

    /*────────────────────────  ADMIN  ───────────────────────────────*/
    function pause() external onlyOwner {
        _pause();
    }
    function unpause() external onlyOwner {
        _unpause();
    }

    /** Update gas bomb protection limit */
    function setMaxScanRange(uint256 _maxScanRange) external onlyOwner {
        require(_maxScanRange > 0 && _maxScanRange <= MAX_SCAN_CEILING, "range outside bounds");
        uint256 oldValue = maxScanRange;
        maxScanRange = _maxScanRange;
        emit MaxScanRangeUpdated(oldValue, _maxScanRange);
    }

    /** Rescue function for unsolicited NFT transfers */
    function adminSweepNFT(uint256 tokenId, address to) external onlyOwner {
        require(!loans[tokenId].active, "loan active");
        require(to != address(0), "invalid address");
        ecoAsset.safeTransferFrom(address(this), to, tokenId, 1, "");
        emit EmergencyNFTWithdrawn(to, tokenId);
    }

    /*────────────────────────  VIEW FUNCTIONS  ─────────────────────*/
    /// @notice Get user's active loans by scanning the loans mapping
    /// @dev This is a view function that may be gas-expensive for large token ranges
    /// @param user The user address to check
    /// @return Array of token IDs for active loans
    function getUserLoans(address user) external view returns (uint256[] memory) {
        uint256 maxTokenId = ecoAsset.lastTokenID();
        uint256 scanLimit = maxTokenId > maxScanRange ? maxScanRange : maxTokenId;

        // First pass: count active loans
        uint256 count = 0;
        for (uint256 i = 1; i <= scanLimit; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                count++;
            }
        }

        // Second pass: collect loan token IDs
        uint256[] memory userLoans = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= scanLimit; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                userLoans[index] = i;
                index++;
            }
        }
        return userLoans;
    }

    /// @notice Get total count of active loans across all users
    /// @dev This is a view function that may be gas-expensive for large token ranges
    function getTotalActiveLoans() external view returns (uint256) {
        uint256 maxTokenId = ecoAsset.lastTokenID();
        uint256 scanLimit = maxTokenId > maxScanRange ? maxScanRange : maxTokenId;
        uint256 count = 0;
        for (uint256 i = 1; i <= scanLimit; i++) {
            if (loans[i].active) {
                count++;
            }
        }
        return count;
    }

    /// @notice Get user's loan count
    /// @param user The user address to check
    function getUserLoanCount(address user) external view returns (uint256) {
        uint256 maxTokenId = ecoAsset.lastTokenID();
        uint256 scanLimit = maxTokenId > maxScanRange ? maxScanRange : maxTokenId;
        uint256 count = 0;
        for (uint256 i = 1; i <= scanLimit; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                count++;
            }
        }
        return count;
    }

    /*────────────────────  PAGINATED VIEW FUNCTIONS  ──────────────*/

    /// @notice Get user's active loans with pagination support
    /// @param user The user address to check
    /// @param startId The token ID to start scanning from (inclusive)
    /// @param limit Maximum number of results to return (capped at MAX_PAGE_SIZE)
    /// @return tokenIds Array of token IDs for active loans in range
    /// @return nextStartId Next token ID to query from (0 if end reached)
    function getUserLoansPaginated(
        address user,
        uint256 startId,
        uint256 limit
    ) external view returns (uint256[] memory tokenIds, uint256 nextStartId) {
        require(startId > 0, "startId must be > 0");
        require(limit > 0 && limit <= MAX_PAGE_SIZE, "invalid limit");

        uint256 maxTokenId = ecoAsset.lastTokenID();
        if (startId > maxTokenId) {
            return (new uint256[](0), 0);
        }

        uint256 endId = startId + limit - 1;
        if (endId > maxTokenId) {
            endId = maxTokenId;
        }

        // First pass: count matching loans
        uint256 count = 0;
        for (uint256 i = startId; i <= endId; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                count++;
            }
        }

        // Second pass: collect matching loans
        tokenIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = startId; i <= endId; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                tokenIds[index] = i;
                index++;
            }
        }

        // Set next start position
        nextStartId = endId < maxTokenId ? endId + 1 : 0;
    }

    /// @notice Get total active loans count with pagination
    /// @param startId The token ID to start scanning from (inclusive)
    /// @param limit Maximum number of tokens to scan (capped at MAX_PAGE_SIZE)
    /// @return count Number of active loans found in range
    /// @return nextStartId Next token ID to query from (0 if end reached)
    function getTotalActiveLoansPaginated(
        uint256 startId,
        uint256 limit
    ) external view returns (uint256 count, uint256 nextStartId) {
        require(startId > 0, "startId must be > 0");
        require(limit > 0 && limit <= MAX_PAGE_SIZE, "invalid limit");

        uint256 maxTokenId = ecoAsset.lastTokenID();
        if (startId > maxTokenId) {
            return (0, 0);
        }

        uint256 endId = startId + limit - 1;
        if (endId > maxTokenId) {
            endId = maxTokenId;
        }

        // Count active loans in range
        for (uint256 i = startId; i <= endId; i++) {
            if (loans[i].active) {
                count++;
            }
        }

        // Set next start position
        nextStartId = endId < maxTokenId ? endId + 1 : 0;
    }

    /// @notice Get user's loan count with pagination
    /// @param user The user address to check
    /// @param startId The token ID to start scanning from (inclusive)
    /// @param limit Maximum number of tokens to scan (capped at MAX_PAGE_SIZE)
    /// @return count Number of user's active loans found in range
    /// @return nextStartId Next token ID to query from (0 if end reached)
    function getUserLoanCountPaginated(
        address user,
        uint256 startId,
        uint256 limit
    ) external view returns (uint256 count, uint256 nextStartId) {
        require(startId > 0, "startId must be > 0");
        require(limit > 0 && limit <= MAX_PAGE_SIZE, "invalid limit");

        uint256 maxTokenId = ecoAsset.lastTokenID();
        if (startId > maxTokenId) {
            return (0, 0);
        }

        uint256 endId = startId + limit - 1;
        if (endId > maxTokenId) {
            endId = maxTokenId;
        }

        // Count user's active loans in range
        for (uint256 i = startId; i <= endId; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                count++;
            }
        }

        // Set next start position
        nextStartId = endId < maxTokenId ? endId + 1 : 0;
    }
}
