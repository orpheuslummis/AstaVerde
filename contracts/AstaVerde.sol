// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract AstaVerde is ERC1155, ERC1155Holder, ERC1155Pausable, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    uint256 constant USDC_PRECISION = 1e6;
    uint256 constant INTERNAL_PRECISION = 1e18;
    uint256 constant PRECISION_FACTOR = INTERNAL_PRECISION / USDC_PRECISION; // 1e12
    uint256 public constant SECONDS_IN_A_DAY = 86400;

    uint256 public platformSharePercentage;
    uint256 public maxBatchSize;
    uint256 public lastBatchID;
    uint256 public lastTokenID;
    uint256 public platformShareAccumulated;
    uint256 public basePrice;
    uint256 public priceFloor;
    uint256 public priceDelta;
    uint256 public priceDecreaseRate;
    uint256 public dayIncreaseThreshold;
    uint256 public dayDecreaseThreshold;

    event BasePriceAdjusted(uint256 newBasePrice, uint256 timestamp, string adjustmentType, uint256 effectiveDays);

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

    struct PricingInfo {
        uint256 lastBaseAdjustmentTime;
        uint256 lastPlatformSaleTime;
        uint256 totalPlatformSalesSinceLastAdjustment;
    }

    struct Share {
        uint256 platformShare;
        uint256 producerShare;
    }

    PricingInfo public pricingInfo;

    mapping(uint256 => TokenInfo) public tokens;
    Batch[] public batches;

    event PlatformSharePercentageSet(uint256 platformSharePercentage);
    event BasePriceForNewBatchesAdjusted(
        uint256 newPrice,
        uint256 timestamp,
        uint256 daysSinceLastAdjustment,
        uint256 totalPlatformSalesSinceLastAdjustment
    );
    event PlatformPriceFloorAdjusted(uint256 newPrice, uint256 timestamp);
    event BatchMinted(uint256 batchId, uint256 batchCreationTime);
    event BatchSold(uint256 batchId, uint256 batchSoldTime, uint256 tokensSold);
    event PartialBatchSold(uint256 batchId, uint256 batchSoldTime, uint256 remainingTokens);
    event TokenRedeemed(uint256 tokenId, address redeemer, uint256 timestamp);
    event PlatformShareAllocated(uint256 amount);
    event ProducerShareAllocated(address indexed producer, uint256 amount);
    event MaxBatchSizeSet(uint256 newSize);
    event AuctionDayThresholdsSet(uint256 increaseThreshold, uint256 decreaseThreshold);
    event PlatformFundsClaimed(address to, uint256 amount);
    event PriceDecreaseRateSet(uint256 newPriceDecreaseRate);
    event PriceDeltaSet(uint256 newPriceDelta);

    constructor(IERC20 _usdcToken, address initialOwner) ERC1155("ipfs://") Ownable(initialOwner) {
        usdcToken = _usdcToken;
        platformSharePercentage = 30;
        maxBatchSize = 50;
        basePrice = 230 * USDC_PRECISION;
        priceFloor = 40 * USDC_PRECISION;
        priceDelta = 10 * USDC_PRECISION;
        priceDecreaseRate = 1 * USDC_PRECISION;
        dayIncreaseThreshold = 2;
        dayDecreaseThreshold = 4;
        pricingInfo.lastBaseAdjustmentTime = block.timestamp;
        lastBatchID = 0;
        lastTokenID = 0;
        pricingInfo.lastBaseAdjustmentTime = block.timestamp;
    }

    receive() external payable {
        revert("Ether not accepted");
    }

    fallback() external payable {
        revert("Ether not accepted");
    }

    // Override supportsInterface to include IERC1155Receiver
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC1155Holder) returns (bool) {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
        emit URI(newuri, type(uint256).max);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked("ipfs://", tokens[tokenId].cid, ".json"));
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Pausable) {
        super._update(from, to, ids, values);
    }

    modifier onlyTokenOwner(uint256[] memory tokenIds) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(tokens[tokenIds[i]].tokenId != 0, "Batch ID is out of bounds");
            require(balanceOf(msg.sender, tokens[tokenIds[i]].tokenId) > 0, "Caller is not the token owner");
        }
        _;
    }

    function setPlatformSharePercentage(uint256 newSharePercentage) external onlyOwner {
        require(newSharePercentage < 100, "Share must be between 0 and 99");
        platformSharePercentage = newSharePercentage;
        emit PlatformSharePercentageSet(newSharePercentage);
    }

    function setPriceDecreaseRate(uint256 newPriceDecreaseRate) external onlyOwner {
        require(newPriceDecreaseRate > 0, "Invalid price decrease rate");
        priceDecreaseRate = newPriceDecreaseRate;
        emit PriceDecreaseRateSet(newPriceDecreaseRate);
    }

    function setPriceDelta(uint256 newPriceDelta) external onlyOwner {
        require(newPriceDelta > 0, "Invalid price delta");
        priceDelta = newPriceDelta;
        emit PriceDeltaSet(newPriceDelta);
    }

    function setPriceFloor(uint256 newPriceFloor) external onlyOwner {
        require(newPriceFloor > 0, "Invalid price floor");
        priceFloor = newPriceFloor;
        emit PlatformPriceFloorAdjusted(newPriceFloor, block.timestamp);
    }

    function setBasePrice(uint256 newStartingPrice) external onlyOwner {
        require(newStartingPrice > 0, "Invalid starting price");
        basePrice = newStartingPrice;
        emit BasePriceForNewBatchesAdjusted(newStartingPrice, block.timestamp, 0, 0);
    }

    function setMaxBatchSize(uint256 newSize) external onlyOwner {
        require(newSize > 0, "Invalid batch size");
        maxBatchSize = newSize;
        emit MaxBatchSizeSet(newSize);
    }

    function setAuctionDayThresholds(uint256 increase, uint256 decrease) external onlyOwner {
        require(increase > 0, "Invalid increase threshold");
        require(decrease > 0, "Invalid decrease threshold");
        require(increase < decrease, "Increase threshold must be lower than decrease threshold");
        dayIncreaseThreshold = increase;
        dayDecreaseThreshold = decrease;
        emit AuctionDayThresholdsSet(increase, decrease);
    }

    function mintBatch(address[] memory producers, string[] memory cids) public onlyOwner whenNotPaused {
        require(producers.length == cids.length, "Mismatch between producers and cids lengths");
        require(producers.length <= maxBatchSize, "Batch size exceeds max batch size");

        for (uint256 i = 0; i < cids.length; i++) {
            require(bytes(cids[i]).length > 0, "CID cannot be empty");
            require(producers[i] != address(0), "Producer address cannot be zero address");
        }

        updateBasePriceOnAction();

        uint256[] memory newTokenIds = new uint256[](producers.length);
        uint256[] memory amounts = new uint256[](producers.length);
        for (uint256 i = 0; i < producers.length; i++) {
            lastTokenID += 1; // Increment to start from 1
            uint256 newTokenId = lastTokenID;
            newTokenIds[i] = newTokenId;
            amounts[i] = 1;
            tokens[newTokenId] = TokenInfo(newTokenId, producers[i], cids[i], false);
        }

        _mintBatch(address(this), newTokenIds, amounts, "");

        uint256 batchID = batches.length;
        lastBatchID = batchID;
        uint256 currentBasePrice = basePrice;
        batches.push(
            Batch(batchID, newTokenIds, block.timestamp, currentBasePrice, currentBasePrice, producers.length)
        );
        emit BatchMinted(batchID, block.timestamp);
    }

    function getCurrentBatchPrice(uint256 batchID) public view returns (uint256) {
        require(batchID < batches.length, "Batch ID is out of bounds");
        Batch storage batch = batches[batchID];
        uint256 timeSinceCreation = block.timestamp - batch.creationTime;
        uint256 daysSinceCreation = timeSinceCreation / SECONDS_IN_A_DAY;

        uint256 priceDecrease = daysSinceCreation * priceDecreaseRate;
        uint256 calculatedPrice = batch.startingPrice > priceDecrease
            ? batch.startingPrice - priceDecrease
            : priceFloor;

        uint256 currentPrice = calculatedPrice >= priceFloor ? calculatedPrice : priceFloor;

        return currentPrice;
    }

    /**
     * @dev Correctly implements Base Price Adjustment.
     * Increases the base price if there have been sales within the dayIncreaseThreshold.
     * Decreases the base price proportionally if no sales have occurred within the dayDecreaseThreshold.
     */
    function updateBasePriceOnAction() internal {
        uint256 currentTime = block.timestamp;
        uint256 timeElapsed = currentTime - pricingInfo.lastBaseAdjustmentTime;
        uint256 daysElapsed = timeElapsed / SECONDS_IN_A_DAY;

        bool hadSales = pricingInfo.totalPlatformSalesSinceLastAdjustment > 0;

        if (hadSales) {
            uint256 timeSinceLastSale = currentTime - pricingInfo.lastPlatformSaleTime;
            if (timeSinceLastSale <= dayIncreaseThreshold * SECONDS_IN_A_DAY) {
                basePrice += priceDelta;
                emit BasePriceAdjusted(basePrice, currentTime, "increase", 1);
            }
        } else if (daysElapsed >= dayDecreaseThreshold) {
            uint256 decreaseDays = daysElapsed - dayDecreaseThreshold + 1;
            uint256 totalDecrease = priceDecreaseRate * decreaseDays;

            uint256 oldBasePrice = basePrice;
            if (basePrice > priceFloor + totalDecrease) {
                basePrice -= totalDecrease;
                emit BasePriceAdjusted(basePrice, currentTime, "decrease", decreaseDays);
            } else {
                basePrice = priceFloor;
            }
            if (basePrice == priceFloor) {
                emit BasePriceAdjusted(basePrice, currentTime, "floor", oldBasePrice - basePrice);
            }
        }

        pricingInfo.lastBaseAdjustmentTime = currentTime;
        pricingInfo.totalPlatformSalesSinceLastAdjustment = 0;
    }

    /**
     * @dev Finds the index of a producer in the uniqueProducers array.
     * @param uniqueProducers The array of unique producer addresses.
     * @param producer The producer address to find.
     * @return index The index of the producer in the array, or the array length if not found.
     */
    function findProducerIndex(address[] memory uniqueProducers, address producer) internal pure returns (uint256) {
        for (uint256 i = 0; i < uniqueProducers.length; i++) {
            if (uniqueProducers[i] == producer) {
                return i;
            }
        }
        return uniqueProducers.length;
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
        require(batchID < batches.length, "Batch ID is out of bounds");
        Batch storage batch = batches[batchID];
        if (batch.remainingTokens == 0) {
            price = batch.price;
        } else {
            price = getCurrentBatchPrice(batchID);
        }
        return (batch.batchId, batch.tokenIds, batch.creationTime, price, batch.remainingTokens);
    }

    function buyBatch(uint256 batchID, uint256 tokenAmount) external whenNotPaused nonReentrant {
        require(batchID < batches.length, "Batch ID is out of bounds");

        // Update the base price based on recent activity before proceeding
        updateBasePriceOnAction();

        Batch storage batch = batches[batchID];
        require(batch.creationTime > 0, "Batch not initialized");
        require(tokenAmount > 0, "Invalid token amount");
        require(tokenAmount <= batch.remainingTokens, "Not enough tokens in batch");

        uint256 currentPrice = getCurrentBatchPrice(batchID);
        require(currentPrice >= priceFloor, "Current price below floor");
        uint256 totalCost = currentPrice * tokenAmount;

        // Fetch the exact number of available tokens needed
        uint256[] memory ids = getPartialIds(batchID, tokenAmount);

        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            amounts[i] = 1;
        }

        // Effects
        batch.remainingTokens -= tokenAmount;

        // Interactions
        usdcToken.safeTransferFrom(msg.sender, address(this), totalCost);
        _safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");

        // Allocate shares per producer using arrays
        address[] memory uniqueProducers = new address[](ids.length);
        uint256[] memory producerShares = new uint256[](ids.length);
        uint256 uniqueCount = 0;
        uint256 totalPlatformShare = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 tokenId = ids[i];
            Share memory share = _calculateShares(currentPrice);
            totalPlatformShare += share.platformShare;

            address producer = tokens[tokenId].producer;
            uint256 index = findProducerIndex(uniqueProducers, producer);

            if (index < uniqueCount) {
                producerShares[index] += share.producerShare;
            } else {
                uniqueProducers[uniqueCount] = producer;
                producerShares[uniqueCount] = share.producerShare;
                uniqueCount++;
            }
        }

        // Accumulate platform shares
        platformShareAccumulated += totalPlatformShare;
        emit PlatformShareAllocated(totalPlatformShare);

        // Transfer aggregated producer shares
        for (uint256 i = 0; i < uniqueCount; i++) {
            usdcToken.safeTransfer(uniqueProducers[i], producerShares[i]);
            emit ProducerShareAllocated(uniqueProducers[i], producerShares[i]);
        }

        // Update pricing information
        pricingInfo.lastPlatformSaleTime = block.timestamp;
        pricingInfo.totalPlatformSalesSinceLastAdjustment += tokenAmount;

        if (batch.remainingTokens == 0) {
            batch.price = currentPrice; // Update batch price
            emit BatchSold(batchID, block.timestamp, batch.tokenIds.length);
        } else {
            emit PartialBatchSold(batchID, block.timestamp, tokenAmount);
        }
    }

    function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
        require(numberToBuy > 0, "Number to buy must be greater than zero");
        uint256[] memory partialIds = new uint256[](numberToBuy);
        uint256 counter = 0;

        for (uint256 i = 0; i < batches[batchID].tokenIds.length && counter < numberToBuy; i++) {
            uint256 tokenId = batches[batchID].tokenIds[i];
            if (balanceOf(address(this), tokenId) > 0) {
                partialIds[counter] = tokenId;
                counter++;
            }
        }

        require(counter == numberToBuy, "Unable to get the required number of tokens");
        return partialIds;
    }

    // Redeemed tokens are useful outside of this contract, e.g. off-chain verification.
    function redeemTokens(uint256[] memory tokenIds) public onlyTokenOwner(tokenIds) nonReentrant whenNotPaused {
        require(tokenIds.length > 0, "No tokens provided for redemption");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(!tokens[tokenId].isRedeemed, "Token is already redeemed");
            tokens[tokenId].isRedeemed = true;
            emit TokenRedeemed(tokenId, msg.sender, block.timestamp);
        }
    }

    function claimPlatformFunds(address to) external onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Address must not be zero");
        require(platformShareAccumulated > 0, "No funds to withdraw");
        uint256 amount = platformShareAccumulated;
        platformShareAccumulated = 0;
        usdcToken.safeTransfer(to, amount);
        emit PlatformFundsClaimed(to, amount);
    }

    function _calculateShares(uint256 price) internal view returns (Share memory) {
        // Using high-precision arithmetic to minimize rounding errors
        uint256 platformShareHighPrecision = (price * PRECISION_FACTOR * platformSharePercentage) / 100;
        uint256 producerShareHighPrecision = (price * PRECISION_FACTOR) - platformShareHighPrecision;

        // Convert back to USDC precision with rounding
        uint256 platformShare = (platformShareHighPrecision + (PRECISION_FACTOR / 2)) / PRECISION_FACTOR;
        uint256 producerShare = (producerShareHighPrecision + (PRECISION_FACTOR / 2)) / PRECISION_FACTOR;

        return Share(platformShare, producerShare);
    }
}
