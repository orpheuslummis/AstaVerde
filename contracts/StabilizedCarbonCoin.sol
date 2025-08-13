// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract StabilizedCarbonCoin is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /** SUPPLY CAP **/
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 1e18; // 1B SCC maximum supply

    constructor(address vault) ERC20("Stabilized Carbon Coin", "SCC") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Optionally grant MINTER_ROLE during deployment to prevent race condition
        if (vault != address(0)) {
            _grantRole(MINTER_ROLE, vault);
        }
        // If vault is address(0), MINTER_ROLE granted explicitly after vault deployment
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(to != address(0), "mint to zero address");
        require(amount > 0, "mint zero amount");
        require(totalSupply() + amount <= MAX_SUPPLY, "exceeds max supply");
        _mint(to, amount);
    }

    function burn(uint256 amount) external {
        require(amount > 0, "burn zero amount");
        _burn(msg.sender, amount);
    }

    function burnFrom(address account, uint256 amount) external {
        require(account != address(0), "burn from zero address");
        require(amount > 0, "burn zero amount");
        _spendAllowance(account, msg.sender, amount);
        _burn(account, amount);
    }

    // Essential for debugging - no enumeration functions
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
