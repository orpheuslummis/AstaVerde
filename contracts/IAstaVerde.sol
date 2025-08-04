// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

// For reading token state AND ERC1155 transfers
interface IAstaVerde is IERC1155 {
    function tokens(uint256) external view returns (
        address owner,
        uint256 tokenId,
        address producer,
        string  memory cid,
        bool    redeemed
    );
    
    function lastTokenID() external view returns (uint256);
} 