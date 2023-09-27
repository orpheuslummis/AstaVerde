// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import {Test} from "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "../src/AstaVerde.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}

contract AstaVerdeTest is Test, IERC1155Receiver {
    AstaVerde private astaVerde;
    MockUSDC private usdc;

    function setUp() public {
        usdc = new MockUSDC();
        astaVerde = new AstaVerde(IERC20(address(usdc)));
    }

    function test_MintBatch() public {
        address[] memory producers = new address[](1);
        producers[0] = address(this);
        string[] memory cids = new string[](1);
        cids[0] = "cid";
        bytes memory data = "";
        astaVerde.mintBatch(producers, cids, data);
        uint256 batchID = astaVerde.lastBatchID();
        (uint256[] memory tokenIds,,) = astaVerde.getBatchInfo(batchID);
        assertEq(tokenIds.length, 1, "Batch size does not match");
        assertEq(tokenIds[0], astaVerde.lastTokenID(), "Token ID does not match");
        assertEq(astaVerde.balanceOf(address(this), tokenIds[0]), 1, "Token balance does not match");
    }

    function testFail_MintBatchWithoutProducers() public {
        address[] memory producers = new address[](0);
        string[] memory cids = new string[](0);
        bytes memory data = "";
        astaVerde.mintBatch(producers, cids, data);
    }

    function testFail_MintBatchWithMismatchedProducersAndCids() public {
        address[] memory producers = new address[](1);
        producers[0] = address(this);
        string[] memory cids = new string[](0);
        bytes memory data = "";
        astaVerde.mintBatch(producers, cids, data);
    }

    function testFail_MintBatchWithBatchSizeTooLarge() public {
        address[] memory producers = new address[](51);
        string[] memory cids = new string[](51);
        bytes memory data = "";
        astaVerde.mintBatch(producers, cids, data);
    }

    function testFail_MintBatchWithInvalidProducerAddress() public {
        address[] memory producers = new address[](1);
        producers[0] = address(0);
        string[] memory cids = new string[](1);
        cids[0] = "cid";
        bytes memory data = "";
        astaVerde.mintBatch(producers, cids, data);
    }

    function test_GetCurrentPrice() public {
        uint256 batchID = 1;
        uint256 expectedPrice = 230; // Assuming the starting price is 230
        assertEq(astaVerde.getCurrentPrice(batchID), expectedPrice, "Current price does not match expected price");
    }

    function testFail_GetCurrentPriceWithInvalidBatchID() public {
        uint256 batchID = 999; // Assuming this batchID does not exist
        assertEq(astaVerde.getCurrentPrice(batchID), 0, "Current price does not match expected price");
    }

    function test_BuyBatch() public {
        uint256 batchID = 1;
        uint256 usdcAmount = 230; // Assuming the price is 230
        uint256 tokenAmount = 1;
        astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
        // TODO: Add assertions to check the state after buying
    }

    function testFail_BuyBatchWithInsufficientFunds() public {
        uint256 batchID = 1;
        uint256 usdcAmount = 100; // Assuming the price is more than 100
        uint256 tokenAmount = 1;
        astaVerde.buyBatch(batchID, usdcAmount, tokenAmount);
    }

    function test_SetPlatformSharePercentage() public {
        uint256 newPercentage = 30; // Assuming the new percentage is 30
        astaVerde.setPlatformSharePercentage(newPercentage);
        assertEq(
            astaVerde.platformSharePercentage(), newPercentage, "Platform share percentage does not match the new value"
        );
    }

    function testFail_SetPlatformSharePercentageWithInvalidValue() public {
        uint256 invalidPercentage = 101; // Assuming the invalid percentage is 101
        astaVerde.setPlatformSharePercentage(invalidPercentage);
    }

    function test_SetPriceFloor() public {
        uint256 newPriceFloor = 100; // Assuming the new price floor is 100
        astaVerde.setPriceFloor(newPriceFloor);
        assertEq(astaVerde.priceFloor(), newPriceFloor, "Price floor does not match the new value");
    }

    function testFail_SetPriceFloorWithZeroValue() public {
        uint256 zeroPriceFloor = 0;
        astaVerde.setPriceFloor(zeroPriceFloor);
    }
    // test_SetStartingPrice(): Test setting the starting price and validate the new value.
    // testFail_SetStartingPriceWithZeroValue(): Test setting the starting price with a zero value.
    // test_SetMaxBatchSize(): Test setting the max batch size and validate the new value.
    // testFail_SetMaxBatchSizeWithZeroValue(): Test setting the max batch size with a zero value.
    // test_UpdateStartingPrice(): Test the update of the starting price based on the last sale duration.
    // test_GetBatchInfo(): Test retrieving batch information and validate the returned values.
    // test_HandleRefund(): Test the refund handling when the USDC amount is greater than the total cost.
    // test_ValidateBatch(): Test the validation of a batch with a valid number to buy.
    // testFail_ValidateBatchWithZeroNumberToBuy(): Test the validation of a batch with a zero number to buy.
    // testFail_ValidateBatchWithNumberToBuyGreaterThanRemainingTokens(): Test the validation of a batch with a number to buy greater than the remaining tokens.
    // test_GetPartialIds(): Test retrieving partial IDs from a batch.
    // testFail_GetPartialIdsWithZeroNumberToBuy(): Test retrieving partial IDs from a batch with a zero number to buy.
    // testFail_GetPartialIdsWithNumberToBuyGreaterThanRemainingTokens(): Test retrieving partial IDs from a batch with a number to buy greater than the remaining tokens.
    // test_RedeemTokens(): Test redeeming tokens by the token owner.
    // testFail_RedeemTokensByNonOwner(): Test the failure of redeeming tokens by a non-owner.
    // test_ClaimPlatformFunds(): Test claiming platform funds by the owner.
    // testFail_ClaimPlatformFundsByNonOwner(): Test the failure of claiming platform funds by a non-owner.
    // testFail_ClaimPlatformFundsWithZeroBalance(): Test the failure of claiming platform funds when the balance is zero.
    // test_PauseAndUnpause(): Test pausing and unpausing the contract by the owner.
    // testFail_PauseAndUnpauseByNonOwner(): Test the failure of pausing and unpausing the contract by a non-owner.
    // test_BuyBatchWhenPaused(): Test the failure of buying a batch when the contract is paused.
    // test_RedeemTokensWhenPaused(): Test the failure of redeeming tokens when the contract is paused.
    // test_ClaimPlatformFundsWhenPaused(): Test the failure of claiming platform funds when the contract is paused.
}
