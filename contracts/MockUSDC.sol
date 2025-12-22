// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDC is ERC20 {
    uint8 private immutable _decimals = 6;

    constructor(uint256 /* initialSupply */) ERC20("Mock USDC", "USDC") {
        // Note: initialSupply parameter is kept for backwards compatibility with deployment scripts
        // but is not used. Tokens are minted via the public mint() function instead.
        // This allows test scripts to have full control over token distribution.

        // Safety check: prevent deployment on production networks
        require(
            block.chainid == 31337 || // Hardhat local
                block.chainid == 84532 || // Base Sepolia
                block.chainid == 11155111 || // Sepolia
                block.chainid == 421614, // Arbitrum Sepolia
            "MockUSDC: Production deployment forbidden"
        );
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
