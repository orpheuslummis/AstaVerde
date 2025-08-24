// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title MaliciousProducer
 * @notice A contract that always reverts when receiving ERC20 tokens
 * @dev Used to test DoS prevention in AstaVerde producer payments
 */
contract MaliciousProducer {
    // Always revert when receiving tokens
    receive() external payable {
        revert("MaliciousProducer: I refuse payments");
    }
    
    // Fallback that also reverts
    fallback() external payable {
        revert("MaliciousProducer: I refuse payments");
    }
    
    // Even if someone tries to call us as an ERC20 receiver
    function onERC20Received() external pure {
        revert("MaliciousProducer: I refuse ERC20");
    }
}