// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract AnotherERC20 is ERC20 {
    constructor(uint256 initialSupply) ERC20("AnotherERC20", "AERC20") {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
