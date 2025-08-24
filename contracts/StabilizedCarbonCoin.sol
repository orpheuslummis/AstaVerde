// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title StabilizedCarbonCoin - Debt Token for Carbon Offset Collateralization
 * @author AstaVerde Team
 * @notice ERC-20 token representing debt against collateralized AstaVerde NFTs
 * @dev Mintable exclusively by EcoStabilizer vault with 1B supply cap
 * 
 * DEPLOYMENT:
 * - Deploy before EcoStabilizer vault
 * - Grant MINTER_ROLE to vault address after vault deployment
 * - Renounce DEFAULT_ADMIN_ROLE for immutable access control
 * - Supply cap of 1B SCC enforced on-chain
 * 
 * KEY MECHANICS:
 * - Fixed issuance: 20 SCC per collateralized NFT
 * - Exclusive minting: Only EcoStabilizer vault can mint
 * - Burn mechanisms: Direct burn() and approved burnFrom()
 * - No transfer fees: Standard ERC-20 transfers
 * - 18 decimals for standard DeFi compatibility
 * 
 * SECURITY:
 * - Role-based access control via OpenZeppelin AccessControl
 * - MINTER_ROLE restricted to single vault address
 * - Supply cap prevents unlimited inflation
 * - Zero address checks on all operations
 * - Amount validation to prevent zero-value operations
 * 
 * PRICE STABILITY:
 * - Arbitrage mechanism with AstaVerde primary market
 * - If 20 SCC < new NFT price: buy SCC, withdraw NFT, sell on primary
 * - If 20 SCC > new NFT price: buy NFT, deposit for SCC, sell SCC
 * - Natural equilibrium around 1/20th of NFT floor price
 */
contract StabilizedCarbonCoin is ERC20, AccessControl {
    /// @notice Role identifier for minting privileges
    /// @dev Should be granted exclusively to EcoStabilizer vault
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /** SUPPLY CAP **/
    /// @notice Maximum total supply of SCC tokens (1 billion with 18 decimals)
    /// @dev Enforced in mint() to prevent inflation beyond ecosystem capacity
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1B SCC maximum supply

    /**
     * @notice Initialize the StabilizedCarbonCoin token
     * @dev Sets up access control and optionally grants MINTER_ROLE to vault
     * 
     * Deployment patterns:
     * 1. With vault address: Deploy SCC with vault address to grant MINTER_ROLE immediately
     * 2. Without vault (address(0)): Deploy SCC first, then grant MINTER_ROLE after vault deployment
     * 
     * Post-deployment:
     * - Admin should grant MINTER_ROLE to vault if not done in constructor
     * - Admin should renounce DEFAULT_ADMIN_ROLE for immutable access control
     * 
     * @param vault Address of the EcoStabilizer vault (or address(0) for later assignment)
     */
    constructor(address vault) ERC20("Stabilized Carbon Coin", "SCC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Optionally grant MINTER_ROLE during deployment to prevent race condition
        if (vault != address(0)) {
            _grantRole(MINTER_ROLE, vault);
        }
        // If vault is address(0), MINTER_ROLE granted explicitly after vault deployment
    }

    /**
     * @notice Mint new SCC tokens to a specified address
     * @dev Only callable by addresses with MINTER_ROLE (should be vault only)
     * 
     * Requirements:
     * - Caller must have MINTER_ROLE
     * - Recipient cannot be zero address
     * - Amount must be greater than 0
     * - Total supply after minting cannot exceed MAX_SUPPLY
     * 
     * @param to Address to receive the minted tokens
     * @param amount Number of tokens to mint (typically 20e18 per NFT)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "mint to zero address");
        require(amount > 0, "mint zero amount");
        require(totalSupply() + amount <= MAX_SUPPLY, "exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @notice Burn SCC tokens from caller's balance
     * @dev Used by EcoStabilizer during NFT withdrawal process
     * 
     * Requirements:
     * - Amount must be greater than 0
     * - Caller must have sufficient balance
     * 
     * @param amount Number of tokens to burn
     */
    function burn(uint256 amount) external {
        require(amount > 0, "burn zero amount");
        _burn(msg.sender, amount);
    }

    /**
     * @notice Burn SCC tokens from another address with approval
     * @dev Alternative burn mechanism using ERC-20 allowance pattern
     * 
     * Requirements:
     * - Account cannot be zero address
     * - Amount must be greater than 0
     * - Caller must have sufficient allowance from account
     * - Account must have sufficient balance
     * 
     * Usage:
     * - Can be used for delegated burning scenarios
     * - Useful for smart contract integrations
     * 
     * @param account Address to burn tokens from
     * @param amount Number of tokens to burn
     */
    function burnFrom(address account, uint256 amount) external {
        require(account != address(0), "burn from zero address");
        require(amount > 0, "burn zero amount");
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }

    /**
     * @notice Get the number of decimals used by the token
     * @dev Standard 18 decimals for ERC-20 compatibility
     * @return Always returns 18
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
