// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDCWithFee
 * @notice Mock ERC20 token that charges a fee on transfers
 * @dev Models the common fee-on-transfer pattern where sender is debited full amount
 *      but recipient receives amount minus fee
 */
contract MockUSDCWithFee is ERC20 {
    uint256 public constant FEE_BPS = 100; // 1% fee in basis points
    address public immutable feeCollector;

    constructor(address _feeCollector) ERC20("Fee USDC", "FUSDC") {
        require(_feeCollector != address(0), "Invalid fee collector");
        feeCollector = _feeCollector;
        _mint(msg.sender, 1000000 * 1e6); // 1M USDC for testing
    }

    function decimals() public pure override returns (uint8) {
        return 6; // USDC has 6 decimals
    }

    /**
     * @dev Override _update to implement fee-on-transfer
     * For OpenZeppelin v5 contracts
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override {
        if (from == address(0) || to == address(0)) {
            // Minting or burning - no fee
            super._update(from, to, amount);
        } else {
            // Transfer - apply fee
            uint256 fee = (amount * FEE_BPS) / 10000;
            uint256 netAmount = amount - fee;
            
            // Recipient gets net amount
            super._update(from, to, netAmount);
            
            // Fee goes to collector (deducted from sender)
            if (fee > 0 && feeCollector != address(0)) {
                super._update(from, feeCollector, fee);
            }
        }
    }

    // Additional helper for testing
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}