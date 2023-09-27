// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract AstaVerde is ERC1155, ERC1155Burnable, Ownable, Pausable, ReentrancyGuard {
    IERC20 public usdcToken;

    uint256 public constant SECONDS_IN_A_DAY = 86400;

    uint256 public platformSharePercentage;
    uint256 public maxBatchSize;

    uint256 public lastBatchID;
    uint256 public lastTokenID;
    uint256 public lastBatchSoldTime;

    uint256 public platformShareAccumulated;

    // unit is USD
    uint256 public startingPrice;
    uint256 public priceFloor;
    uint256 public priceDecreaseRate;

    struct TokenInfo {
        uint256 tokenId;
        address producer;
        string cid;
        bool isRedeemed;
    }

    struct Batch {
        uint256[] tokenIds;
        uint256 creationTime;
        uint256 price;
        uint256 remainingTokens;
    }

    mapping(uint256 => TokenInfo) public tokenInfos;
    Batch[] public batches;
    // mapping(address => uint256) producerPayouts;

    event PlatformSharePercentageSet(uint256 platformSharePercentage);
    event PlatformStartingPriceAdjusted(uint256 newPrice, uint256 timestamp);
    event PlatformPriceFloorAdjusted(uint256 newPrice, uint256 timestamp);
    event BatchCreated(uint256 batchId, uint256 batchCreationTime);
    event BatchSold(uint256 batchId, uint256 batchSoldTime);
    event PartialBatchSold(uint256 batchId, uint256 batchSoldTime, uint256 remainingTokens);
    event TokenSold(uint256 tokenId, address buyer, uint256 price, uint256 batchSoldTime, address producer);
    event TokenReedemed(uint256 tokenId, address redeemer, uint256 timestamp);

    constructor(IERC20 _usdcToken) ERC1155("ipfs://") {
        require(Address.isContract(address(_usdcToken)), "ERC20: _usdcToken is not a contract");
        usdcToken = _usdcToken;
        platformSharePercentage = 30;
        maxBatchSize = 50;
        startingPrice = 230;
        priceFloor = 40;
        priceDecreaseRate = 1;
    }

    function setURI(string memory newuri) public onlyOwner {
        _setURI(newuri);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    modifier onlyUSDC(IERC20 _token) {
        require(address(_token) == address(usdcToken), "Only USDC tokens accepted");
        _;
    }

    modifier onlyTokenOwner(uint256[] memory tokenIds) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(balanceOf(msg.sender, tokenIds[i]) > 0, "Only the owner can redeem");
        }
        _;
    }

    function setPlatformSharePercentage(uint256 newSharePercentage) external onlyOwner {
        require(newSharePercentage >= 0 && newSharePercentage <= 100, "Share must be between 0 and 100");
        platformSharePercentage = newSharePercentage;
        emit PlatformSharePercentageSet(newSharePercentage);
    }

    function setPriceFloor(uint256 newPriceFloor) external onlyOwner {
        require(newPriceFloor > 0, "Invalid price floor");
        priceFloor = newPriceFloor;
        emit PlatformPriceFloorAdjusted(newPriceFloor, block.timestamp);
    }

    function setStartingPrice(uint256 newStartingPrice) external onlyOwner {
        require(newStartingPrice > 0, "Invalid starting price");
        startingPrice = newStartingPrice;
        emit PlatformStartingPriceAdjusted(newStartingPrice, block.timestamp);
    }

    function setMaxBatchSize(uint256 newSize) external onlyOwner {
        require(newSize > 0, "Invalid batch size");
        maxBatchSize = newSize;
    }

    function mintBatch(address[] memory producers, string[] memory cids, bytes memory data) public onlyOwner {
        require(producers.length > 0, "No producers provided");
        require(producers.length == cids.length, "Mismatch between producers and cids lengths");
        require(producers.length <= maxBatchSize, "Batch size too large");
        for (uint256 i = 0; i < producers.length; i++) {
            require(producers[i] != address(0), "Invalid producer address");
        }

        updateStartingPrice();

        uint256[] memory newTokenIds = new uint256[](producers.length);

        Batch memory newBatch;
        newBatch.tokenIds = new uint256[](producers.length);
        newBatch.creationTime = block.timestamp;
        newBatch.price = startingPrice;
        newBatch.remainingTokens = producers.length;

        // Add the new batch to the batches array before trying to access it
        batches.push(newBatch);

        uint256 newBatchID = batches.length - 1;

        uint256[] memory amounts = new uint256[](producers.length);
        for (uint256 i = 0; i < producers.length; i++) {
            uint256 newTokenID = ++lastTokenID;
            newTokenIds[i] = newTokenID;

            TokenInfo memory newTokenInfo =
                TokenInfo({tokenId: newTokenID, producer: producers[i], cid: cids[i], isRedeemed: false});
            tokenInfos[newTokenID] = newTokenInfo;

            newBatch.tokenIds[i] = newTokenID;
            amounts[i] = 1;
        }

        batches[newBatchID] = newBatch;
        emit BatchCreated(newBatchID, newBatch.creationTime);

        _mintBatch(address(this), newTokenIds, amounts, data);
    }

    function getCurrentPrice(uint256 batchID) public view returns (uint256) {
        require(batchID < batches.length, "Batch not initialized");

        Batch memory batch = batches[batchID];
        uint256 elapsedTime = block.timestamp - batch.creationTime;
        uint256 priceDecrease = (elapsedTime / SECONDS_IN_A_DAY) * priceDecreaseRate;
        uint256 currentPrice = batch.price >= priceDecrease ? batch.price - priceDecrease : priceFloor;

        return currentPrice;
    }

    function updateStartingPrice() internal {
        uint256 lastSaleDuration = block.timestamp - lastBatchSoldTime;

        if (lastSaleDuration < SECONDS_IN_A_DAY * 4) {
            startingPrice += 10;
        } else if (lastSaleDuration > SECONDS_IN_A_DAY * 10) {
            startingPrice -= 10;
        }

        if (startingPrice < priceFloor) {
            startingPrice = priceFloor;
        }

        emit PlatformStartingPriceAdjusted(startingPrice, block.timestamp);
    }

    function getBatchInfo(uint256 batchID)
        public
        view
        returns (uint256[] memory tokenIds, uint256 creationTime, uint256 price)
    {
        Batch memory batch = batches[batchID];
        return (batch.tokenIds, batch.creationTime, batch.price);
    }

    function handleRefund(uint256 usdcAmount, uint256 totalCost) internal {
        if (usdcAmount <= totalCost) return;
        uint256 refundAmount = usdcAmount - totalCost;
        require(usdcToken.transfer(msg.sender, refundAmount), "Refund failed");
    }

    function validateBatch(uint256 batchID, uint256 numberToBuy) internal view returns (uint256) {
        require(batches[batchID].creationTime > 0, "Batch not initialized");
        require(numberToBuy > 0, "Number to buy must be greater than zero");
        require(numberToBuy <= batches[batchID].remainingTokens, "Not enough tokens in the batch");
        return getCurrentPrice(batchID) * numberToBuy;
    }

    function buyBatch(uint256 batchID, uint256 usdcAmount, uint256 tokenAmount) external whenNotPaused nonReentrant {
        uint256 totalCost = validateBatch(batchID, tokenAmount);
        require(usdcAmount >= totalCost, "Insufficient funds sent");

        handleRefund(usdcAmount, totalCost);

        batches[batchID].remainingTokens -= tokenAmount;

        uint256 producerSharePerToken = (totalCost * (100 - platformSharePercentage)) / 100;
        uint256 platformShare = totalCost - producerSharePerToken;
        platformShareAccumulated += platformShare;

        uint256[] memory ids = (tokenAmount == batches[batchID].tokenIds.length)
            ? batches[batchID].tokenIds
            : getPartialIds(batchID, tokenAmount);

        uint256[] memory amounts = new uint256[](ids.length);
        address[] memory uniqueProducers = new address[](ids.length);
        uint256[] memory uniquePayouts = new uint256[](ids.length);
        uint256 uniqueCount = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            amounts[i] = 1;
            address producer = tokenInfos[ids[i]].producer;

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

        require(usdcToken.transferFrom(msg.sender, address(this), usdcAmount), "Transfer failed");

        for (uint256 i = 0; i < uniqueCount; i++) {
            require(usdcToken.transfer(uniqueProducers[i], uniquePayouts[i]), "Producer transfer failed");
        }

        safeBatchTransferFrom(address(this), msg.sender, ids, amounts, "");

        if (batches[batchID].remainingTokens == 0) {
            emit BatchSold(batchID, block.timestamp);
        } else {
            emit PartialBatchSold(batchID, block.timestamp, batches[batchID].remainingTokens);
        }
    }

    function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
        require(numberToBuy > 0, "Number to buy must be greater than zero");
        require(numberToBuy <= batches[batchID].remainingTokens, "Not enough tokens in the batch");
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

    // Token owner marks the credit(s) as redeemed/used.
    // An offchain system keeps track of the redeemed tokens.
    function redeemTokens(uint256[] memory tokenIds) public onlyTokenOwner(tokenIds) nonReentrant {
        require(tokenIds.length > 0, "No tokens provided for redemption");
        require(tokenIds.length <= maxBatchSize, "Too many tokens provided for redemption");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(tokenInfos[tokenId].tokenId != 0, "Token does not exist");
            require(!tokenInfos[tokenId].isRedeemed, "Token is already redeemed");
            tokenInfos[tokenId].isRedeemed = true;
            emit TokenReedemed(tokenId, msg.sender, block.timestamp);
        }
    }

    function claimPlatformFunds(address to) external onlyOwner nonReentrant {
        require(to != address(0), "Address must not be zero");
        require(platformShareAccumulated > 0, "No funds to withdraw");
        require(Address.isContract(to), "Address must be a contract capable of receiving ERC20 tokens"); // todo: check if this is enough
        require(usdcToken.transfer(to, platformShareAccumulated), "Withdrawal failed");
        platformShareAccumulated = 0;
    }
}
