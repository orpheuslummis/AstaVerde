// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract StabilizedCarbonCoin is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor() ERC20("Stabilized Carbon Coin", "SCC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // MINTER_ROLE granted explicitly after vault deployment
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }

    // Essential for debugging - no enumeration functions
    function decimals() public pure override returns (uint8) { 
        return 18; 
    }
} 