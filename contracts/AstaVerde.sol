// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";

import "hardhat/console.sol"; // TBD remove logging before production

/*
AstaVerde is a carbon credits marketplace, selling batches through Dutch auction, where each credit is a token and ‘redeemable’.
The batch is a unit of pricing: all tokens of a batch share the same price, which follows its own Dutch auction dynamics.
*/
contract AstaVerde is
    ERC1155,
    ERC1155Pausable,
    Ownable,
    IERC1155Receiver,
    ReentrancyGuard
{
    IERC20 public usdcToken;
    uint256 constant USDC_PRECISION = 10 ** 6;

    uint256 public constant SECONDS_IN_A_DAY = 86400;

    uint256 public platformSharePercentage;
    uint256 public maxBatchSize;
    // batches are zero-indexed, so both the no batch and the first batch have ID 0
    uint256 public lastBatchID;
    uint256 public lastTokenID;
    uint256 public lastBatchSoldTime;
    uint256 public platformShareAccumulated;
    // unit is USDC
    uint256 public basePrice;
    uint256 public priceFloor;
    uint256 public priceDelta;
    uint256 public priceDecreaseRate;
    // Controlling the auction
    uint256 public dayIncreaseThreshold;
    uint256 public dayDecreaseThreshold;

    struct TokenInfo {
        uint256 tokenId;
        address producer;
        string cid;
        bool isRedeemed;
    }

    struct Batch {
        uint256 batchId;
        uint256[] tokenIds;
        uint256 creationTime;
        uint256 startingPrice;
        uint256 price;
        uint256 remainingTokens;
    }

    mapping(uint256 => TokenInfo) public tokens;
    Batch[] public batches;

    event PlatformSharePercentageSet(uint256 platformSharePercentage);
    event PlatformBasePriceAdjusted(uint256 newPrice, uint256 timestamp);
    event PlatformPriceFloorAdjusted(uint256 newPrice, uint256 timestamp);
    event BatchMinted(uint256 batchId, uint256 batchCreationTime);
    event BatchSold(uint256 batchId, uint256 batchSoldTime, uint256 tokensSold);
    event PartialBatchSold(
        uint256 batchId,
        uint256 batchSoldTime,
        uint256 remainingTokens
    );
    event TokenSold(
        uint256 tokenId,
        address buyer,
        uint256 price,
        uint256 batchSoldTime,
        address producer
    );
    event TokenReedemed(uint256 tokenId, address redeemer, uint256 timestamp);

    constructor(
        address initialOwner,
        IERC20 _usdcToken
    ) ERC1155("ipfs://") Ownable(initialOwner) {
        usdcToken = _usdcToken;
        platformSharePercentage = 30;
        maxBatchSize = 50;
        basePrice = 230 * USDC_PRECISION;
        priceFloor = 40 * USDC_PRECISION;
        priceDelta = 10 * USDC_PRECISION;
        priceDecreaseRate = 1 * USDC_PRECISION;
        dayIncreaseThreshold = 2;
        dayDecreaseThreshold = 4;
    }

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return
            string(abi.encodePacked(super.uri(tokenId), tokens[tokenId].cid));
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function onERC1155Received(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onERC1155BatchReceived.selector;
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Pausable) {
        super._update(from, to, ids, values);
    }

    modifier onlyUSDC(IERC20 _token) {
        require(
            address(_token) == address(usdcToken),
            "Only USDC tokens accepted"
        );
        _;
    }

    modifier onlyTokenOwner(uint256[] memory tokenIds) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(
                balanceOf(msg.sender, tokenIds[i]) > 0,
                "Only the owner can redeem"
            );
        }
        _;
    }

    function setPlatformSharePercentage(
        uint256 newSharePercentage
    ) external onlyOwner {
        require(
            newSharePercentage >= 0 && newSharePercentage <= 100,
            "Share must be between 0 and 100"
        );
        platformSharePercentage = newSharePercentage;
        emit PlatformSharePercentageSet(newSharePercentage);
    }

    function setPriceFloor(uint256 newPriceFloor) external onlyOwner {
        require(newPriceFloor > 0, "Invalid price floor");
        priceFloor = newPriceFloor;
        emit PlatformPriceFloorAdjusted(newPriceFloor, block.timestamp);
    }

    function setBasePrice(uint256 newStartingPrice) external onlyOwner {
        require(newStartingPrice > 0, "Invalid starting price");
        basePrice = newStartingPrice;
        emit PlatformBasePriceAdjusted(newStartingPrice, block.timestamp);
    }

    function setMaxBatchSize(uint256 newSize) external onlyOwner {
        require(newSize > 0, "Invalid batch size");
        maxBatchSize = newSize;
    }

    function setAuctionTimeThresholds(
        uint256 increase,
        uint256 decrease
    ) external onlyOwner {
        require(increase > 0, "Invalid increase threshold");
        require(decrease > 0, "Invalid decrease threshold");
        require(
            increase < decrease,
            "Increase threshold must be lower than decrease threshold"
        );
        dayIncreaseThreshold = increase;
        dayDecreaseThreshold = decrease;
    }

    function mintBatch(
        address[] memory producers,
        string[] memory cids
    ) public onlyOwner whenNotPaused {
        require(producers.length > 0, "No producers provided");
        require(
            cids.length <= maxBatchSize,
            "Batch size exceeds max batch size"
        );
        require(
            producers.length == cids.length,
            "Mismatch between producers and cids lengths"
        );

        uint256 batchSize = producers.length;

        if (batches.length == 0) {
            lastBatchID = 0;
        } else {
            lastBatchID = lastBatchID + 1;
        }

        updateBasePrice();

        Batch memory newBatch;
        newBatch.batchId = lastBatchID;
        newBatch.tokenIds = new uint256[](batchSize);
        newBatch.creationTime = block.timestamp;
        newBatch.price = basePrice;
        newBatch.startingPrice = basePrice;
        newBatch.remainingTokens = batchSize;

        uint256[] memory newTokenIds = new uint256[](batchSize);
        uint256[] memory amounts = new uint256[](batchSize);

        for (uint256 i = 0; i < batchSize; i++) {
            uint256 newTokenID = ++lastTokenID;
            newTokenIds[i] = newTokenID;
            TokenInfo memory newTokenInfo = TokenInfo({
                tokenId: newTokenID,
                producer: producers[i],
                cid: cids[i],
                isRedeemed: false
            });
            tokens[newTokenID] = newTokenInfo;

            newBatch.tokenIds[i] = newTokenID;
            amounts[i] = 1;
        }

        batches.push(newBatch);
        emit BatchMinted(newBatch.batchId, block.timestamp);
        _mintBatch(address(this), newTokenIds, amounts, "");
    }

    // The price decreases daily based on the `priceDecreaseRate`, but not below priceFloor.
    function getBatchPrice(uint256 batchID) public view returns (uint256) {
        require(batchID < batches.length, "Batch does not exist");
        Batch memory batch = batches[batchID];
        uint256 elapsedTime = block.timestamp - batch.creationTime;
        uint256 priceDecrease = (elapsedTime / SECONDS_IN_A_DAY) *
            priceDecreaseRate;
        uint256 currentPrice;
        // we want to avoid the underfow
        if (priceDecrease >= batch.startingPrice) {
            return priceFloor;
        }
        currentPrice = batch.startingPrice - priceDecrease;
        if (currentPrice < priceFloor) {
            return priceFloor;
        }
        return currentPrice;
    }

    // Updates the starting price of the next batch based on the last sale duration.
    // Increases by 10 if less than X days, decreases by 10 if more than Y days, and sets to price floor if below it.
    function updateBasePrice() internal {
        // Skip the price update for the zero-index batch
        if (lastBatchID == 0) {
            return;
        }

        uint256 timeSinceLastSale = block.timestamp - lastBatchSoldTime;

        if (timeSinceLastSale == block.timestamp) {
            // first batch
            return;
        } else if (
            timeSinceLastSale < SECONDS_IN_A_DAY * dayIncreaseThreshold
        ) {
            basePrice += priceDelta;
        } else if (
            timeSinceLastSale > SECONDS_IN_A_DAY * dayDecreaseThreshold
        ) {
            basePrice -= priceDelta;
        }

        if (basePrice < priceFloor) {
            basePrice = priceFloor;
        }
        emit PlatformBasePriceAdjusted(basePrice, block.timestamp);
    }

    function getBatchInfo(
        uint256 batchID
    )
        public
        view
        returns (
            uint256 batchId,
            uint256[] memory tokenIds,
            uint256 creationTime,
            uint256 price,
            uint256 remainingTokens
        )
    {
        require(batchID <= batches.length, "Batch ID is out of bounds");
        Batch memory batch = batches[batchID];
        price = getBatchPrice(batchID);
        return (
            batch.batchId,
            batch.tokenIds,
            batch.creationTime,
            price,
            batch.remainingTokens
        );
    }

    /**
     * This function enables token batch purchase. It performs the following:
     * - Validates the batch and the purchase amount.
     * - Calculates and updates the platform and producer shares.
     * - Handles token batch purchase and producer payouts.
     * - Transfers tokens to the buyer and refunds any excess USDC.
     * - Emits events based on whether the entire batch or only a part is sold.
     */
    function buyBatch(
        uint256 batchID,
        uint256 usdcAmount,
        uint256 tokenAmount
    ) external whenNotPaused nonReentrant {
        console.log("buyBatch", batchID, usdcAmount, tokenAmount);
        console.log("contract balance", usdcToken.balanceOf(address(this)));
        require(batches[batchID].creationTime > 0, "Batch not initialized");
        require(tokenAmount > 0, "Number to buy must be greater than zero");
        console.log(
            "buyBatch remainingTokens",
            batches[batchID].remainingTokens
        );
        require(
            tokenAmount <= batches[batchID].remainingTokens,
            "Not enough tokens in batch"
        );
        uint256 price = getBatchPrice(batchID);
        batches[batchID].price = price;
        uint256 totalCost = price * tokenAmount;
        require(usdcAmount >= totalCost, "Insufficient funds sent");
        require(
            usdcToken.transferFrom(msg.sender, address(this), usdcAmount),
            "Transfer from user failed"
        );
        console.log(
            "balance, contract balance:",
            usdcAmount,
            usdcToken.balanceOf(address(this))
        );

        if (usdcAmount > totalCost) {
            require(
                usdcToken.transfer(msg.sender, usdcAmount - totalCost),
                "Refund failed"
            );
        }

        batches[batchID].remainingTokens -= tokenAmount;

        // Split the amount paid into platform and producer shares
        // Using two decimal places of precision
        uint256 producerSharePerToken = (price *
            (10000 - platformSharePercentage * 100)) / 10000;
        uint256 platformSharePerToken = price - producerSharePerToken;
        platformShareAccumulated += platformSharePerToken * tokenAmount;
        assert(producerSharePerToken + platformSharePerToken == price);
        console.log("price per token", price);
        console.log("producerSharePerToken", producerSharePerToken);
        console.log("platformSharePerToken", platformSharePerToken);
        console.log("platformShareAccumulated", platformShareAccumulated);

        /**
         * This section handles token batch purchase. It determines the token ids to be purchased,
         * tracks the token amounts, unique producers, and producer payouts. It then iterates over the
         * token ids, increments the token amount, retrieves the token producer, checks if the producer
         * is unique, increments the payout for existing producers, and adds new producers to the list.
         */
        uint256[] memory ids = (tokenAmount == batches[batchID].tokenIds.length)
            ? batches[batchID].tokenIds
            : getPartialIds(batchID, tokenAmount);

        uint256[] memory amounts = new uint256[](ids.length);
        address[] memory uniqueProducers = new address[](ids.length);
        uint256[] memory uniquePayouts = new uint256[](ids.length);
        uint256 uniqueCount = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            amounts[i] = 1;
            address producer = tokens[ids[i]].producer;

            bool isNewProducer = true;
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (uniqueProducers[j] == producer) {
                    uniquePayouts[j] += producerSharePerToken;
                    isNewProducer = false;
                    break;
                }
            }

            if (isNewProducer) {
                uniqueProducers[uniqueCount] = producer;
                uniquePayouts[uniqueCount] = producerSharePerToken;
                uniqueCount++;
            }
        }

        console.log("uniqueCount: %s", uniqueCount);
        for (uint256 i = 0; i < uniqueCount; i++) {
            // TBD
            require(
                usdcToken.transfer(uniqueProducers[i], uniquePayouts[i]),
                "Producer transfer failed"
            );
            // console.log("uniquePayouts[i]: %s", uniquePayouts[i]);
            // console.log("uniqueProducers[i]: %s", uniqueProducers[i]);
            // console.log(
            //     "platformShareAccumulated, contract balance:",
            //     platformShareAccumulated,
            //     usdcToken.balanceOf(address(this))
            // );
        }

        this.setApprovalForAll(msg.sender, true);
        safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
        this.setApprovalForAll(msg.sender, false);

        if (batches[batchID].remainingTokens == 0) {
            lastBatchSoldTime = block.timestamp;
            emit BatchSold(
                batchID,
                block.timestamp,
                batches[batchID].tokenIds.length
            );
        } else {
            emit PartialBatchSold(batchID, block.timestamp, tokenAmount);
        }
    }

    // This function fetches a specified number of available token IDs from a given batch.
    function getPartialIds(
        uint256 batchID,
        uint256 numberToBuy
    ) internal view returns (uint256[] memory) {
        // console.log("getPartialIds remainingTokens", batches[batchID].remainingTokens);
        // console.log("getPartialIds getPartialIds", batchID, numberToBuy, batches[batchID].tokenIds.length);
        require(numberToBuy > 0, "Number to buy must be greater than zero");
        uint256[] memory partialIds = new uint256[](numberToBuy);
        uint256 counter = 0;

        for (
            uint256 i = 0;
            i < batches[batchID].tokenIds.length && counter < numberToBuy;
            i++
        ) {
            uint256 tokenId = batches[batchID].tokenIds[i];
            if (balanceOf(address(this), tokenId) > 0) {
                partialIds[counter] = tokenId;
                counter++;
            }
        }

        require(
            counter == numberToBuy,
            "Unable to get the required number of tokens"
        );
        return partialIds;
    }

    // Token owner marks the credit(s) as redeemed/used.
    // An offchain system keeps track of the redeemed tokens.
    function redeemTokens(
        uint256[] memory tokenIds
    ) public onlyTokenOwner(tokenIds) nonReentrant whenNotPaused {
        require(tokenIds.length > 0, "No tokens provided for redemption");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(tokens[tokenId].tokenId != 0, "Token does not exist");
            require(!tokens[tokenId].isRedeemed, "Token is already redeemed");
            tokens[tokenId].isRedeemed = true;
            emit TokenReedemed(tokenId, msg.sender, block.timestamp);
        }
    }

    // Allows the contract owner to claim accumulated platform funds after validating the recipient address and platform balance.
    function claimPlatformFunds(
        address to
    ) external onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Address must not be zero");
        require(platformShareAccumulated > 0, "No funds to withdraw");
        require(
            usdcToken.transfer(to, platformShareAccumulated),
            "Withdrawal failed"
        );
        platformShareAccumulated = 0;
    }
}
