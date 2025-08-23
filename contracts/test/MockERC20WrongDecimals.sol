// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20WrongDecimals
 * @notice Mock ERC20 token with 18 decimals for testing decimals validation
 */
contract MockERC20WrongDecimals is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {
        _mint(msg.sender, 1000000 * 1e18);
    }

    function decimals() public pure override returns (uint8) {
        return 18; // Wrong decimals for USDC compatibility
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}