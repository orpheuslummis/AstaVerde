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

    /** IMMUTABLES **/
    IAstaVerde             public immutable ecoAsset; // ERC1155 + token data
    StabilizedCarbonCoin   public immutable scc;

    /** STATE **/
    struct Loan { 
        address borrower; 
        bool active; 
    }
    mapping(uint256 => Loan) public loans; // tokenId → Loan

    /** EVENTS **/
    event Deposited(address indexed user, uint256 indexed tokenId);
    event Withdrawn(address indexed user, uint256 indexed tokenId);  
    event EmergencyNFTWithdrawn(address indexed to, uint256 indexed tokenId);

    constructor(address _ecoAsset, address _scc) Ownable(msg.sender) {
        ecoAsset = IAstaVerde(_ecoAsset);
        scc = StabilizedCarbonCoin(_scc);
    }

    /*────────────────────────  CORE FUNCTIONS  ───────────────────────*/
    function deposit(uint256 tokenId) external nonReentrant whenNotPaused {
        require(!loans[tokenId].active, "loan active");
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
        Loan memory L = loans[tokenId];
        require(L.active && L.borrower == msg.sender, "not borrower");

        // Burn SCC directly from user's balance (requires prior approval of 20 SCC to vault)
        scc.burnFrom(msg.sender, SCC_PER_ASSET);
        
        // Transfer NFT back
        ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");
        
        // Update state
        loans[tokenId].active = false;
        
        emit Withdrawn(msg.sender, tokenId);
    }

    /// @notice Convenience function: identical to withdraw but with different name for UX
    /// @dev Still requires user to approve vault for 20 SCC spend before calling
    function repayAndWithdraw(uint256 tokenId) external nonReentrant whenNotPaused {
        Loan memory L = loans[tokenId];
        require(L.active && L.borrower == msg.sender, "not borrower");

        // Burn SCC directly from user's balance (requires prior approval of 20 SCC to vault)
        scc.burnFrom(msg.sender, SCC_PER_ASSET);
        
        // Transfer NFT back
        ecoAsset.safeTransferFrom(address(this), msg.sender, tokenId, 1, "");
        
        // Update state
        loans[tokenId].active = false;
        
        emit Withdrawn(msg.sender, tokenId);
    }

    /*────────────────────────  ADMIN  ───────────────────────────────*/
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /** Rescue function for unsolicited NFT transfers */
    function adminSweepNFT(uint256 tokenId, address to) external onlyOwner {
        require(!loans[tokenId].active, "loan active");
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
        
        // First pass: count active loans
        uint256 count = 0;
        for (uint256 i = 1; i <= maxTokenId; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                count++;
            }
        }
        
        // Second pass: collect loan token IDs
        uint256[] memory userLoans = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 1; i <= maxTokenId; i++) {
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
        uint256 count = 0;
        for (uint256 i = 1; i <= maxTokenId; i++) {
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
        uint256 count = 0;
        for (uint256 i = 1; i <= maxTokenId; i++) {
            if (loans[i].active && loans[i].borrower == user) {
                count++;
            }
        }
        return count;
    }
} 