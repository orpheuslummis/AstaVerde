// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract AstaVerde is ERC1155, ERC1155Pausable, ERC1155Holder, Ownable, ReentrancyGuard {
    IERC20 public immutable usdcToken;
    uint256 constant INTERNAL_PRECISION = 1e18;
    uint256 constant USDC_PRECISION = 1e6;
    uint256 constant PRECISION_FACTOR = INTERNAL_PRECISION / USDC_PRECISION;
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
    uint256 public lastPriceChangeTime;

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
    event PriceDecreaseRateSet(uint256 newPriceDecreaseRate);
    event BasePriceIncreased(uint256 newPrice, uint256 timestamp);
    event BasePriceDecreased(uint256 newPrice, uint256 timestamp);
    event PlatformFundsClaimed(address to, uint256 amount);
    event MaxBatchSizeSet(uint256 newMaxBatchSize);

    constructor(address owner, IERC20 _usdcToken) ERC1155("ipfs://") Ownable(owner) {
        usdcToken = _usdcToken;
        platformSharePercentage = 30;
        maxBatchSize = 50;
        basePrice = 230 * USDC_PRECISION;
        priceFloor = 40 * USDC_PRECISION;
        priceDelta = 10 * USDC_PRECISION;
        priceDecreaseRate = 5 * USDC_PRECISION;
        dayIncreaseThreshold = 2;
        dayDecreaseThreshold = 4;
        lastBatchID = 0;
        pricingInfo.lastBaseAdjustmentTime = block.timestamp;
        lastPriceChangeTime = block.timestamp;
    }

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(super.uri(tokenId), tokens[tokenId].cid));
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
            require(tokens[tokenIds[i]].tokenId != 0, "Token does not exist");
            require(balanceOf(msg.sender, tokenIds[i]) > 0, "Caller is not the token owner");
        }
        _;
    }

    function setPlatformSharePercentage(uint256 newSharePercentage) external onlyOwner {
        require(newSharePercentage < 100, "Share must be between 0 and 99");
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
    }

    function mintBatch(address[] memory producers, string[] memory cids) public onlyOwner whenNotPaused {
        require(producers.length > 0, "No producers provided");
        require(producers.length == cids.length, "Mismatch between producers and cids lengths");
        require(producers.length <= maxBatchSize, "Batch size exceeds max batch size");

        updateBasePriceOnAction();

        uint256[] memory ids = new uint256[](producers.length);
        uint256[] memory amounts = new uint256[](producers.length);

        for (uint256 i = 0; i < producers.length; i++) {
            lastTokenID++;
            ids[i] = lastTokenID;
            amounts[i] = 1;
            tokens[lastTokenID] = TokenInfo(lastTokenID, producers[i], cids[i], false);
        }

        _mintBatch(address(this), ids, amounts, "");

        lastBatchID++;
        batches.push(Batch(lastBatchID, ids, block.timestamp, basePrice, basePrice, producers.length));
        emit BatchMinted(lastBatchID, block.timestamp);
    }

    function getCurrentBatchPrice(uint256 batchID) public view returns (uint256) {
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        Batch storage batch = batches[batchID - 1];
        uint256 timeSinceCreation = block.timestamp - batch.creationTime;
        uint256 daysSinceCreation = timeSinceCreation / SECONDS_IN_A_DAY;

        uint256 priceDecrease = daysSinceCreation * priceDecreaseRate;
        uint256 currentPrice = batch.startingPrice > priceDecrease ? batch.startingPrice - priceDecrease : priceFloor;

        return currentPrice > priceFloor ? currentPrice : priceFloor;
    }

    function updateBasePriceOnAction() public {
        uint256 daysSinceLastBaseAdjustment = (block.timestamp - pricingInfo.lastBaseAdjustmentTime) / SECONDS_IN_A_DAY;
        uint256 timeSinceLastSale = block.timestamp - pricingInfo.lastPlatformSaleTime;

        bool priceAdjusted = false;

        if (
            pricingInfo.totalPlatformSalesSinceLastAdjustment > 0 && daysSinceLastBaseAdjustment < dayIncreaseThreshold
        ) {
            basePrice += priceDelta;
            emit BasePriceIncreased(basePrice, block.timestamp);
            priceAdjusted = true;
        } else if (daysSinceLastBaseAdjustment >= dayDecreaseThreshold) {
            uint256 daysToDecrease = daysSinceLastBaseAdjustment;
            uint256 totalPriceDecrease = daysToDecrease * priceDecreaseRate;
            uint256 newBasePrice = (basePrice > totalPriceDecrease) ? (basePrice - totalPriceDecrease) : priceFloor;
            basePrice = (newBasePrice > priceFloor) ? newBasePrice : priceFloor;
            emit BasePriceDecreased(basePrice, block.timestamp);
            priceAdjusted = true;
        }

        if (priceAdjusted) {
            pricingInfo.lastBaseAdjustmentTime = block.timestamp;
            pricingInfo.totalPlatformSalesSinceLastAdjustment = 0;
        }

        pricingInfo.lastPlatformSaleTime = block.timestamp;
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
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        Batch storage batch = batches[batchID - 1];
        if (batch.remainingTokens == 0) {
            price = batch.price;
        } else {
            price = getCurrentBatchPrice(batchID);
        }
        return (batch.batchId, batch.tokenIds, batch.creationTime, price, batch.remainingTokens);
    }

    function buyBatch(uint256 batchID, uint256 usdcAmount, uint256 tokenAmount) external whenNotPaused nonReentrant {
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        Batch storage batch = batches[batchID - 1];
        require(batch.creationTime > 0, "Batch not initialized");
        require(tokenAmount > 0, "Invalid token amount");
        require(tokenAmount <= batch.remainingTokens, "Not enough tokens in batch");

        uint256 currentPrice = getCurrentBatchPrice(batchID);
        uint256 totalCost = currentPrice * tokenAmount;
        require(usdcAmount >= totalCost, "Insufficient funds sent");
        require(usdcToken.transferFrom(msg.sender, address(this), usdcAmount), "Transfer from user failed");

        if (usdcAmount > totalCost) {
            require(usdcToken.transfer(msg.sender, usdcAmount - totalCost), "Refund failed");
        }

        batch.remainingTokens -= tokenAmount;

        pricingInfo.totalPlatformSalesSinceLastAdjustment += tokenAmount;

        updateBasePriceOnAction();

        if (batch.remainingTokens == 0) {
            batch.price = currentPrice;
        }

        uint256 highPrecisionPrice = currentPrice * PRECISION_FACTOR;
        uint256 totalHighPrecisionPrice = highPrecisionPrice * tokenAmount;

        uint256 platformShareHighPrecision = (totalHighPrecisionPrice * platformSharePercentage) / 100;
        uint256 producerShareHighPrecision = totalHighPrecisionPrice - platformShareHighPrecision;

        uint256 platformShare = (platformShareHighPrecision + PRECISION_FACTOR / 2) / PRECISION_FACTOR;
        uint256 producerShare = (producerShareHighPrecision + PRECISION_FACTOR / 2) / PRECISION_FACTOR;

        platformShareAccumulated += platformShare;

        uint256[] memory ids = (tokenAmount == batch.tokenIds.length)
            ? batch.tokenIds
            : getPartialIds(batchID, tokenAmount);

        _handleTokenTransfer(ids, producerShare / tokenAmount);

        if (batch.remainingTokens == 0) {
            emit BatchSold(batchID, block.timestamp, batch.tokenIds.length);
        } else {
            emit PartialBatchSold(batchID, block.timestamp, tokenAmount);
        }
    }

    function _handleTokenTransfer(uint256[] memory ids, uint256 producerSharePerToken) private {
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

        for (uint256 i = 0; i < uniqueCount; i++) {
            require(usdcToken.transfer(uniqueProducers[i], uniquePayouts[i]), "Producer transfer failed");
        }

        _safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");
    }

    function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        require(numberToBuy > 0, "Number to buy must be greater than zero");
        uint256[] memory partialIds = new uint256[](numberToBuy);
        uint256 counter = 0;

        for (uint256 i = 0; i < batches[batchID - 1].tokenIds.length && counter < numberToBuy; i++) {
            uint256 tokenId = batches[batchID - 1].tokenIds[i];
            if (balanceOf(address(this), tokenId) > 0) {
                partialIds[counter] = tokenId;
                counter++;
            }
        }

        require(counter == numberToBuy, "Unable to get the required number of tokens");
        return partialIds;
    }

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
        uint256 amountToWithdraw = platformShareAccumulated;
        platformShareAccumulated = 0;
        require(usdcToken.transfer(to, amountToWithdraw), "Withdrawal failed");
        emit PlatformFundsClaimed(to, amountToWithdraw);
    }

    function setPriceDecreaseRate(uint256 newPriceDecreaseRate) external onlyOwner {
        require(newPriceDecreaseRate > 0, "Invalid price decrease rate");
        priceDecreaseRate = newPriceDecreaseRate;
        emit PriceDecreaseRateSet(newPriceDecreaseRate);
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}