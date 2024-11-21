// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract AstaVerde is ERC1155, ERC1155Pausable, ERC1155Holder, Ownable, ReentrancyGuard {
    IERC20 public immutable usdcToken;
    uint256 constant INTERNAL_PRECISION = 1e18;
    uint256 constant USDC_PRECISION = 1e6;
    uint256 constant PRECISION_FACTOR = INTERNAL_PRECISION / USDC_PRECISION;
    uint256 public constant SECONDS_IN_A_DAY = 86400;
    uint256 public constant PRICE_WINDOW = 90 days;

    uint256 public platformSharePercentage;
    uint256 public maxBatchSize;
    uint256 public lastBatchID;
    uint256 public lastTokenID;
    uint256 public platformShareAccumulated;
    uint256 public basePrice;
    uint256 public priceFloor;
    uint256 public dailyPriceDecay;
    uint256 public priceAdjustDelta;
    uint256 public dayIncreaseThreshold;
    uint256 public dayDecreaseThreshold;
    uint256 public lastPriceAdjustmentTime;
    uint256 public lastCompleteSaleTime;

    struct TokenInfo {
        address owner;
        uint256 tokenId;
        address producer;
        string cid;
        bool redeemed;
    }

    struct Batch {
        uint256 batchId;
        uint256[] tokenIds;
        uint256 creationTime;
        uint256 startingPrice;
        uint256 remainingTokens;
    }

    mapping(uint256 => TokenInfo) public tokens;
    Batch[] public batches;
    mapping(uint256 => uint256) public batchSoldTime;
    mapping(uint256 => uint256) public batchFinalPrice;
    mapping(uint256 => bool) public batchUsedInPriceDecrease;
    mapping(uint256 => uint256) public batchCreationIndex;

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
    event PriceDeltaSet(uint256 newPriceDelta);
    event BasePriceAdjusted(uint256 newBasePrice, uint256 timestamp, bool increased);
    event PlatformFundsClaimed(address to, uint256 amount);
    event MaxBatchSizeSet(uint256 newMaxBatchSize);
    event DailyPriceDecaySet(uint256 newDailyDecay);
    event ProducerPayment(address indexed producer, uint256 amount);

    error NotProducer(address caller);
    error NotTokenOwner(address caller);
    error TokenAlreadyRedeemed(uint256 tokenId);

    constructor(address owner, IERC20 _usdcToken) ERC1155("ipfs://") Ownable(owner) {
        usdcToken = _usdcToken;
        platformSharePercentage = 30;
        maxBatchSize = 50;
        basePrice = 230 * USDC_PRECISION;
        priceFloor = 40 * USDC_PRECISION;
        dailyPriceDecay = 1 * USDC_PRECISION;
        priceAdjustDelta = 10 * USDC_PRECISION;
        dayIncreaseThreshold = 2;
        dayDecreaseThreshold = 4;
        lastBatchID = 0;
        lastPriceAdjustmentTime = block.timestamp;
        lastCompleteSaleTime = block.timestamp;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
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
            require(balanceOf(msg.sender, tokens[tokenIds[i]].tokenId) > 0, "Caller is not the token owner");
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

    function setPriceDelta(uint256 newPriceDelta) external onlyOwner {
        require(newPriceDelta > 0, "Price delta must be positive");
        priceAdjustDelta = newPriceDelta;
        emit PriceDeltaSet(newPriceDelta);
    }

    function setDailyPriceDecay(uint256 newDailyDecay) external onlyOwner {
        require(newDailyDecay > 0, "Daily decay must be positive");
        dailyPriceDecay = newDailyDecay;
        emit DailyPriceDecaySet(newDailyDecay);
    }

    function mintBatch(address[] memory producers, string[] memory cids) public onlyOwner whenNotPaused {
        require(producers.length > 0, "No producers provided");
        require(producers.length == cids.length, "Mismatch between producers and cids lengths");
        require(producers.length <= maxBatchSize, "Batch size exceeds max batch size");

        updateBasePrice();

        uint256[] memory ids = new uint256[](producers.length);
        uint256[] memory amounts = new uint256[](producers.length);

        for (uint256 i = 0; i < producers.length; i++) {
            lastTokenID++;
            ids[i] = lastTokenID;
            amounts[i] = 1;
            tokens[lastTokenID] = TokenInfo(msg.sender, lastTokenID, producers[i], cids[i], false);
        }

        _mintBatch(address(this), ids, amounts, "");

        lastBatchID++;
        uint256 newIndex = batches.length;
        batches.push(Batch(lastBatchID, ids, block.timestamp, basePrice, producers.length));
        batchCreationIndex[lastBatchID] = newIndex;

        emit BatchMinted(lastBatchID, block.timestamp);
    }

    function getCurrentBatchPrice(uint256 batchID) public view returns (uint256) {
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        Batch storage batch = batches[batchID - 1];

        if (batchSoldTime[batchID] > 0) {
            return batchFinalPrice[batchID];
        }

        uint256 daysSinceCreation = (block.timestamp - batch.creationTime) / SECONDS_IN_A_DAY;
        uint256 decayedPrice = batch.startingPrice - (daysSinceCreation * dailyPriceDecay);

        return decayedPrice > priceFloor ? decayedPrice : priceFloor;
    }

    function getBatchInfo(uint256 batchID) public view returns (uint256, uint256[] memory, uint256, uint256, uint256) {
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        Batch storage batch = batches[batchID - 1];

        return (
            batch.batchId,
            batch.tokenIds,
            batch.creationTime,
            getCurrentBatchPrice(batchID),
            batch.remainingTokens
        );
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

        uint256 refundAmount = usdcAmount > totalCost ? usdcAmount - totalCost : 0;

        uint256[] memory ids = (tokenAmount == batch.tokenIds.length)
            ? batch.tokenIds
            : getPartialIds(batchID, tokenAmount);

        (address[] memory recipients, uint256[] memory amounts, uint256 platformShare) = calculateTransferDetails(
            ids,
            currentPrice,
            tokenAmount
        );

        batch.remainingTokens -= tokenAmount;
        platformShareAccumulated += platformShare;

        if (batch.remainingTokens == 0) {
            batchSoldTime[batchID] = block.timestamp;
            batchFinalPrice[batchID] = currentPrice;
            lastCompleteSaleTime = block.timestamp;
            emit BatchSold(batchID, block.timestamp, tokenAmount);
        } else {
            emit PartialBatchSold(batchID, block.timestamp, batch.remainingTokens);
        }

        updateBasePrice();

        require(usdcToken.transferFrom(msg.sender, address(this), totalCost), "Transfer from user failed");

        if (refundAmount > 0) {
            require(usdcToken.transfer(msg.sender, refundAmount), "Refund failed");
        }

        for (uint256 i = 0; i < recipients.length; i++) {
            if (amounts[i] > 0) {
                require(usdcToken.transfer(recipients[i], amounts[i]), "Producer transfer failed");
                emit ProducerPayment(recipients[i], amounts[i]);
            }
        }

        uint256[] memory tokenAmounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            tokenAmounts[i] = 1;
        }
        _safeBatchTransferFrom(address(this), msg.sender, ids, tokenAmounts, "");
    }

    function calculateTransferDetails(
        uint256[] memory ids,
        uint256 currentPrice,
        uint256 tokenAmount
    ) private view returns (address[] memory recipients, uint256[] memory amounts, uint256 platformShare) {
        // Calculate total first to minimize precision loss
        uint256 totalPrice = currentPrice * tokenAmount;
        platformShare = (totalPrice * platformSharePercentage) / 100;
        uint256 producerShare = totalPrice - platformShare;

        // Count unique producers first
        uint256 uniqueCount;
        address[] memory tempProducers = new address[](ids.length);
        uint256[] memory tempAmounts = new uint256[](ids.length);

        // First pass: calculate exact shares without division
        for (uint256 i = 0; i < ids.length; ) {
            TokenInfo storage token = tokens[ids[i]];
            bool found;

            for (uint256 j = 0; j < uniqueCount; ) {
                if (tempProducers[j] == token.producer) {
                    tempAmounts[j] += producerShare / ids.length; // Divide total by number of tokens
                    found = true;
                    break;
                }
                unchecked {
                    ++j;
                }
            }

            if (!found) {
                tempProducers[uniqueCount] = token.producer;
                tempAmounts[uniqueCount] = producerShare / ids.length;
                unchecked {
                    ++uniqueCount;
                }
            }
            unchecked {
                ++i;
            }
        }

        // Create final arrays
        recipients = new address[](uniqueCount);
        amounts = new uint256[](uniqueCount);

        // Copy values and calculate total
        uint256 totalDistributed;
        for (uint256 i = 0; i < uniqueCount; ) {
            recipients[i] = tempProducers[i];
            amounts[i] = tempAmounts[i];
            totalDistributed += amounts[i];
            unchecked {
                ++i;
            }
        }

        // Add rounding difference to platform share
        platformShare += (producerShare - totalDistributed);
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

    function redeemToken(uint256 tokenId) external nonReentrant {
        TokenInfo storage token = tokens[tokenId];
        require(balanceOf(msg.sender, tokenId) > 0, "Caller is not the token owner");
        require(!token.redeemed, "Token already redeemed");

        token.redeemed = true;
        emit TokenRedeemed(tokenId, msg.sender, block.timestamp);
    }

    function claimPlatformFunds(address to) external onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Address must not be zero");
        require(platformShareAccumulated > 0, "No funds to withdraw");
        uint256 amountToWithdraw = platformShareAccumulated;
        platformShareAccumulated = 0;
        require(usdcToken.transfer(to, amountToWithdraw), "Withdrawal failed");
        emit PlatformFundsClaimed(to, amountToWithdraw);
    }

    function updateBasePrice() private {
        uint256 currentTime = block.timestamp;
        if (batches.length == 0) return;

        // Add minimum window start time to prevent including very old batches
        uint256 windowStart = Math.max(
            currentTime > PRICE_WINDOW ? currentTime - PRICE_WINDOW : 0,
            batches[0].creationTime // Use first batch as minimum
        );

        // PRICE INCREASES - only count recent quick sales
        uint256 quickSaleCount = 0;
        uint256 batchesToCheck = Math.min(10, batches.length); // Look at max 10 most recent batches
        for (uint256 i = batches.length; i > batches.length - batchesToCheck; i--) {
            Batch storage batch = batches[i - 1];
            if (batch.creationTime < windowStart) break;

            if (batchSoldTime[batch.batchId] > lastPriceAdjustmentTime && batch.remainingTokens == 0) {
                uint256 saleDurationInDays = (batchSoldTime[batch.batchId] - batch.creationTime) / SECONDS_IN_A_DAY;
                if (saleDurationInDays < dayIncreaseThreshold) {
                    quickSaleCount++;
                }
            }
        }

        if (quickSaleCount > 0) {
            uint256 totalIncrease = quickSaleCount * priceAdjustDelta;
            basePrice = Math.max(priceFloor, basePrice + totalIncrease);
            lastPriceAdjustmentTime = currentTime;
            emit BasePriceAdjusted(basePrice, currentTime, true);
            return;
        }

        // PRICE DECREASES - only consider recent batches
        uint256 daysWithoutSales = (currentTime - lastCompleteSaleTime) / SECONDS_IN_A_DAY;

        if (daysWithoutSales >= dayDecreaseThreshold) {
            uint256 thresholdStartTime = currentTime - (dayDecreaseThreshold * SECONDS_IN_A_DAY);
            uint256 unsoldBatchCount = 0;

            for (uint256 i = batches.length; i > 0 && batches[i - 1].creationTime >= windowStart; i--) {
                Batch storage batch = batches[i - 1];
                if (
                    batch.creationTime <= thresholdStartTime &&
                    batch.remainingTokens == batch.tokenIds.length &&
                    !batchUsedInPriceDecrease[batch.batchId]
                ) {
                    unsoldBatchCount++;
                    batchUsedInPriceDecrease[batch.batchId] = true;
                }
            }

            if (unsoldBatchCount > 0) {
                uint256 totalDecrease = unsoldBatchCount * priceAdjustDelta;
                uint256 newBasePrice = basePrice > totalDecrease ? basePrice - totalDecrease : priceFloor;
                basePrice = Math.max(priceFloor, newBasePrice);
                lastPriceAdjustmentTime = currentTime;
                emit BasePriceAdjusted(basePrice, currentTime, false);
            }
        }
    }
}
