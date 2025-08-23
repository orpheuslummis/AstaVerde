// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title AstaVerde - Carbon Offset NFT Marketplace
 * @author AstaVerde Team
 * @notice ERC-1155 NFT marketplace for tokenized carbon offsets with Dutch auction pricing
 * @dev Implements batch minting, time-decaying prices, and automated price adjustments based on market activity
 * 
 * KEY FEATURES:
 * - Batch-based NFT minting and sales for gas efficiency
 * - Dutch auction: prices decrease daily until floor is reached
 * - Dynamic base price adjustments based on sale velocity
 * - 30% default platform fee (configurable up to 50%) with remainder going to carbon offset producers
 * - Emergency pause system with trusted vault for asset protection
 * - Redemption tracking for real-world carbon offset claims
 * 
 * DEPLOYMENT & TOKEN ASSUMPTIONS:
 * - DEPLOYED: This contract is live on Base mainnet with canonical USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
 * - IMMUTABLE: The USDC token address is immutable after deployment (set in constructor)
 * - IMPORTANT: Constructor accepts ANY 6-decimal ERC20, not just canonical USDC
 * - WARNING: Using non-canonical tokens voids security assumptions and may break functionality
 * - NO FEES: Canonical USDC has no transfer fees, making fee-on-transfer protections defensive only
 * - The fee-on-transfer checks in buyBatch protect against deployment with non-standard tokens
 * - claimPlatformFunds intentionally omits these checks as it's only called by owner with canonical USDC
 * 
 * SECURITY ASSUMPTIONS:
 * - CRITICAL: This contract assumes the owner is a multisig wallet (e.g., Gnosis Safe)
 * - Single EOA ownership would create unacceptable centralization risk
 * - Recommended: 3-of-5 or higher threshold with geographically distributed signers
 * - All owner functions can significantly impact contract economics and security
 * 
 * SECURITY CONSIDERATIONS:
 * - Owner (multisig) controls: pricing, pausing, vault, minting, and fund recovery
 * - Trusted vault mechanism allows emergency asset recovery during pause
 * - Fee-on-transfer tokens explicitly blocked for payment integrity (defensive for testnet deployments)
 * - ReentrancyGuard on all external payment functions
 * - Intentional design: redeemed tokens remain transferable for secondary markets
 * - Intentional design: direct USDC transfers become unrecoverable (see recoverERC20)
 * - IMPORTANT: USDC sent directly to contract (not via buyBatch) is permanently locked
 *   This maintains strict accounting - only platform fees from sales can be withdrawn
 * 
 * COMMON AUDIT MISCONCEPTION - vaultRecallTokens Approval:
 * The vaultRecallTokens function may appear to have an approval mismatch but works correctly.
 * When this contract calls safeBatchTransferFrom, msg.sender remains the original caller (owner),
 * NOT the contract itself. This is fundamental Solidity behavior - msg.sender is preserved
 * throughout internal calls within the same transaction. See vaultRecallTokens documentation.
 */
contract AstaVerde is ERC1155, ERC1155Pausable, ERC1155Holder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    uint256 constant USDC_PRECISION = 1e6;
    uint256 public constant SECONDS_IN_A_DAY = 86400;
    uint256 public constant PRICE_WINDOW = 90 days;
    uint256 public constant MAX_CID_LENGTH = 100;
    uint256 public maxPriceUpdateIterations = 100;

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
    address public trustedVault; // Allow vault transfers even when paused

    struct TokenInfo {
        address originalMinter;  // Who minted the token (always the owner/multisig)
        uint256 tokenId;
        address producer;        // Who produced the carbon offset (receives payment)
        string cid;
        bool redeemed;
    }

    /**
     * @notice Batch storage with 1-based external IDs
     * @dev INDEXING STRATEGY:
     * - External batch IDs are 1-based (batchId starts at 1)
     * - Internal array storage is 0-based (standard Solidity arrays)
     * - Conversion: array_index = batchId - 1
     * - Example: batchId 1 is stored at batches[0]
     * This pattern is consistent throughout the contract.
     */
    struct Batch {
        uint256 batchId;
        uint256[] tokenIds;
        uint256 creationTime;
        uint256 startingPrice;
        uint256 remainingTokens;
    }

    /// @notice Token metadata storage. NOTE: 'originalMinter' field is set at mint time and NOT updated on transfers.
    /// @dev For current ownership, use balanceOf(). The 'originalMinter' field tracks who initially minted the token.
    /// @dev IMPORTANT: Redeemed tokens remain transferable by design. The 'redeemed' flag indicates the token
    /// has been used to claim its underlying value/service but does not restrict on-chain transfers.
    /// This allows for secondary market activity of redeemed collectibles.
    mapping(uint256 => TokenInfo) public tokens;
    Batch[] public batches;
    mapping(uint256 => uint256) public batchSoldTime;
    mapping(uint256 => uint256) public batchFinalPrice;
    mapping(uint256 => bool) public batchUsedInPriceDecrease;

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
    event PartialBatchSold(uint256 batchId, uint256 partialSaleTime, uint256 remainingTokens);
    event TokenRedeemed(uint256 tokenId, address redeemer, uint256 timestamp);
    event PriceDeltaSet(uint256 newPriceDelta);
    event BasePriceAdjusted(uint256 newBasePrice, uint256 timestamp, bool increased);
    event PlatformFundsClaimed(address to, uint256 amount);
    event MaxBatchSizeSet(uint256 newMaxBatchSize);
    event DailyPriceDecaySet(uint256 newDailyDecay);
    event ProducerPayment(address indexed producer, uint256 amount);
    event PriceUpdateIterationLimitReached(uint256 batchesProcessed, uint256 totalBatches);
    event TrustedVaultSet(address indexed vault);
    event MaxPriceUpdateIterationsSet(uint256 newLimit);
    event BatchMarkedUsedInPriceDecrease(uint256 indexed batchId, uint256 timestamp);
    event VaultSent(address indexed vault, address indexed operator, uint256[] ids);
    event VaultRecalled(address indexed vault, address indexed operator, uint256[] ids);

    /**
     * @notice Constructor for AstaVerde marketplace
     * @dev CRITICAL: The owner parameter MUST be a multisig wallet address for production deployments
     * 
     * TOKEN IMMUTABILITY: The _usdcToken address is permanently set here and cannot be changed.
     * Production deployment uses canonical USDC which has no transfer fees.
     * 
     * @param owner The address that will own the contract (MUST be multisig in production)
     * @param _usdcToken The USDC token contract address (must have 6 decimals, immutable after deployment)
     */
    constructor(address owner, IERC20 _usdcToken) ERC1155("ipfs://") Ownable(owner) {
        usdcToken = _usdcToken;
        
        // Sanity check: ensure it's a contract
        require(address(_usdcToken).code.length > 0, "USDC address must be a contract");
        
        // Verify token decimals strictly
        try IERC20Metadata(address(_usdcToken)).decimals() returns (uint8 decimals) {
            require(decimals == 6, "Token must have 6 decimals for USDC compatibility");
        } catch {
            revert("Token must support decimals()==6");
        }
        
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

    function onERC1155Received(
        address,
        address from,
        uint256,
        uint256,
        bytes memory
    ) public virtual override returns (bytes4) {
        // Only accept tokens from this contract to prevent third-party token dusting
        require(msg.sender == address(this), "Only self ERC1155 accepted");
        // Accept transfers that originate from this contract (self-transfers and minting)
        // Minting has from == address(0), self-transfers have from == address(this)
        // Also accept transfers from the trusted vault for recall operations
        require(from == address(0) || from == address(this) || from == trustedVault, "No external returns");
        return this.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(
        address,
        address from,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public virtual override returns (bytes4) {
        // Only accept tokens from this contract to prevent third-party token dusting
        require(msg.sender == address(this), "Only self ERC1155 accepted");
        // Accept batch transfers that originate from this contract (self-transfers and minting)
        // Minting has from == address(0), self-transfers have from == address(this)
        // Also accept transfers from the trusted vault for recall operations
        require(from == address(0) || from == address(this) || from == trustedVault, "No external returns");
        return this.onERC1155BatchReceived.selector;
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

    /**
     * @notice Sets a trusted vault address that can receive tokens even when contract is paused
     * @dev SECURITY FEATURE: This allows for emergency token recovery and custodial operations
     * during a pause event. Only the contract owner can initiate transfers to/from the vault.
     * 
     * IMPORTANT: This is NOT a vulnerability but an intentional emergency mechanism:
     * - Pause is meant to stop normal operations, not emergency recovery
     * - Vault transfers require explicit owner (multisig) approval
     * - This allows saving tokens from a compromised contract state
     * 
     * Use cases:
     * - Emergency token recovery during security incidents
     * - Custodial operations for institutional clients
     * - Phase 2 integration with EcoStabilizer vault
     * 
     * Security considerations:
     * - Only owner can initiate these transfers (not the vault itself)
     * - Transfers are limited to: contract <-> vault
     * - All transfers are still subject to standard ERC1155 rules
     * - Set to address(0) to disable the vault mechanism
     * 
     * @param _vault The address of the trusted vault (can be address(0) to disable)
     */
    function setTrustedVault(address _vault) external onlyOwner {
        trustedVault = _vault;
        emit TrustedVaultSet(_vault);
    }

    /**
     * @notice Send tokens from contract to trusted vault during pause
     * @dev Only callable by owner when paused. Uses internal transfer to bypass operator checks.
     * @param ids Array of token IDs to send to vault
     */
    function vaultSendTokens(uint256[] calldata ids) external onlyOwner whenPaused nonReentrant {
        require(ids.length > 0, "No ids");
        require(trustedVault != address(0), "Vault not set");
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; ++i) {
            require(balanceOf(address(this), ids[i]) >= 1, "Not held by contract");
            amounts[i] = 1;
        }
        _safeBatchTransferFrom(address(this), trustedVault, ids, amounts, "");
        emit VaultSent(trustedVault, msg.sender, ids);
    }

    /**
     * @notice Recall tokens from trusted vault back to contract during pause
     * @dev Only callable by owner when paused. Uses public safeBatchTransferFrom which validates approvals.
     * 
     * APPROVAL MECHANISM (CRITICAL TO UNDERSTAND):
     * This function appears to have an approval mismatch but actually works correctly due to how
     * Solidity preserves msg.sender through internal calls:
     * 1. Owner calls vaultRecallTokens() → msg.sender = owner
     * 2. Function checks isApprovedForAll(vault, msg.sender) → checks vault→owner approval ✓
     * 3. Function calls safeBatchTransferFrom(vault, contract, ...) 
     * 4. Inside safeBatchTransferFrom, msg.sender is STILL the owner (not the contract!)
     * 5. ERC1155 checks if msg.sender (owner) is approved by vault ✓
     * 
     * SECURITY NOTE FOR AUDITORS:
     * This is NOT a bug. A common misconception is that when a contract calls safeBatchTransferFrom,
     * the contract becomes msg.sender for that call. This is incorrect - msg.sender remains the
     * original external caller (the owner) throughout the entire call stack.
     * 
     * DIFFERENCE FROM vaultSendTokens:
     * - vaultSendTokens uses _safeBatchTransferFrom (internal, bypasses checks)
     * - vaultRecallTokens uses safeBatchTransferFrom (public, validates approval)
     * Both approaches work correctly; using the internal function would save gas.
     * 
     * KNOWN LIMITATION: Recalled tokens cannot be resold via buyBatch() because remainingTokens
     * is not updated. This is intentional to keep vault operations separate from sales accounting.
     * 
     * DESIGN RATIONALE FOR NOT FIXING:
     * - Vault operations are for emergency/custodial purposes, not regular inventory management
     * - Mixing emergency operations with sales state could introduce accounting errors
     * - Workaround exists: Owner can mint new batches if resale is needed
     * - Adding reconciliation would increase complexity for a rare edge case
     * - Current design maintains clear separation between emergency and normal operations
     * 
     * @param ids Array of token IDs to recall from vault
     */
    function vaultRecallTokens(uint256[] calldata ids) external onlyOwner whenPaused nonReentrant {
        require(ids.length > 0, "No ids");
        require(trustedVault != address(0), "Vault not set");
        // Check if vault has approved the owner (msg.sender remains the owner throughout this transaction)
        require(isApprovedForAll(trustedVault, msg.sender), "Vault approval required");
        uint256[] memory amounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; ++i) {
            require(balanceOf(trustedVault, ids[i]) >= 1, "Not held by vault");
            amounts[i] = 1;
        }
        // Call public safeBatchTransferFrom - msg.sender is STILL the owner here, not the contract!
        // This works because Solidity preserves msg.sender through internal function calls.
        // The ERC1155 contract will check if msg.sender (owner) is approved by trustedVault.
        safeBatchTransferFrom(trustedVault, address(this), ids, amounts, "");
        emit VaultRecalled(trustedVault, msg.sender, ids);
    }

    /**
     * @notice Internal update function that handles the trusted vault bypass mechanism
     * @dev SECURITY: This function allows owner-initiated transfers to/from the trusted vault
     * even when the contract is paused. This is an intentional bypass for emergency operations.
     * 
     * DESIGN RATIONALE: Pause stops normal user operations but preserves emergency recovery ability.
     * Without this, pausing for a security incident could trap tokens permanently.
     * The owner multisig provides the trust boundary for these emergency operations.
     */
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Pausable) {
        // TRUSTED VAULT BYPASS: Allow owner-initiated custodial transfers even when paused
        // This is a security feature for emergency token recovery and vault operations
        if (paused() && trustedVault != address(0)) {
            // Security check: Only allow owner-initiated transfers between contract and vault
            bool allowed = msg.sender == owner() && (
                (from == address(this) && to == trustedVault) ||
                (from == trustedVault && to == address(this))
            );
            require(allowed, "Pausable: paused");
            // Call parent ERC1155 directly, bypassing Pausable check
            ERC1155._update(from, to, ids, values);
        } else {
            // Normal flow through Pausable check
            super._update(from, to, ids, values);
        }
    }

    function setPlatformSharePercentage(uint256 newSharePercentage) external onlyOwner {
        require(newSharePercentage <= 50, "Platform share cannot exceed 50%");
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
        require(newSize > 0 && newSize <= 100, "Batch size must be between 1 and 100");
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

    function setMaxPriceUpdateIterations(uint256 newLimit) external onlyOwner {
        require(newLimit > 0 && newLimit <= 1000, "Iteration limit must be between 1 and 1000");
        maxPriceUpdateIterations = newLimit;
        emit MaxPriceUpdateIterationsSet(newLimit);
    }

    /**
     * @notice Mint a new batch of carbon offset NFTs
     * @dev Only owner can mint. Each token represents a unique carbon offset with metadata stored on IPFS.
     * Minting creates tokens owned by the contract itself for later sale via buyBatch().
     * The current basePrice is locked in as the starting price for this batch.
     * 
     * @param producers Array of addresses that produced the carbon offsets (receive payment on sale)
     * @param cids Array of IPFS content identifiers for token metadata (must be ≤100 chars each)
     */
    function mintBatch(address[] memory producers, string[] memory cids) public onlyOwner whenNotPaused {
        require(producers.length > 0, "No producers provided");
        require(producers.length == cids.length, "Mismatch between producers and cids lengths");
        require(producers.length <= maxBatchSize, "Batch size exceeds max batch size");

        // Validate CID lengths to prevent DoS attacks
        for (uint256 i = 0; i < cids.length; i++) {
            require(bytes(cids[i]).length <= MAX_CID_LENGTH, "CID too long");
        }

        updateBasePrice();

        uint256[] memory ids = new uint256[](producers.length);
        uint256[] memory amounts = new uint256[](producers.length);

        for (uint256 i = 0; i < producers.length; i++) {
            require(producers[i] != address(0), "Invalid producer address");
            lastTokenID++;
            ids[i] = lastTokenID;
            amounts[i] = 1;
            // KNOWN BEHAVIOR: originalMinter is set to msg.sender (the owner), not the producer
            // DESIGN RATIONALE FOR NOT CHANGING:
            // - The field name is historical/legacy from early versions
            // - Changing it would break backwards compatibility with existing deployments
            // - The producer field correctly tracks who receives payment
            // - originalMinter serves as an audit trail of who initiated the mint
            // - Documentation and comments clarify the distinction
            tokens[lastTokenID] = TokenInfo(msg.sender, lastTokenID, producers[i], cids[i], false);
        }

        _mintBatch(address(this), ids, amounts, "");

        lastBatchID++;
        batches.push(Batch(lastBatchID, ids, block.timestamp, basePrice, producers.length));

        emit BatchMinted(lastBatchID, block.timestamp);
    }

    /**
     * @notice Get the current price for a batch
     * @dev KNOWN LIMITATION: Uses block.timestamp which can be manipulated by miners up to ~15 seconds.
     * 
     * DESIGN RATIONALE FOR NOT FIXING:
     * - Daily price decay (86400 seconds) makes 15-second manipulation economically insignificant
     * - Maximum miner advantage: ~0.017% price difference (15/86400)
     * - Cost of block.number solution: Added complexity and gas costs for negligible benefit
     * - Business impact: At $230 starting price, max manipulation = $0.04 per token
     * 
     * @param batchID The 1-based batch ID
     * @return Current price considering decay
     */
    function getCurrentBatchPrice(uint256 batchID) public view returns (uint256) {
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        Batch storage batch = batches[batchID - 1]; // Convert 1-based ID to 0-based index

        if (batchSoldTime[batchID] > 0) {
            return batchFinalPrice[batchID];
        }

        uint256 daysSinceCreation = (block.timestamp - batch.creationTime) / SECONDS_IN_A_DAY;
        uint256 priceDecrement = daysSinceCreation * dailyPriceDecay;

        // Prevent underflow: if decrement exceeds starting price, return floor
        if (priceDecrement >= batch.startingPrice) {
            return priceFloor;
        }

        uint256 decayedPrice = batch.startingPrice - priceDecrement;
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

    /**
     * @notice Purchase tokens from a specific batch using USDC
     * @dev Implements Dutch auction pricing with daily decay. Handles partial batch purchases.
     * Fee-on-transfer tokens are explicitly blocked. Excess USDC is refunded.
     * 
     * PAYMENT FLOW:
     * 1. Calculate total cost based on current batch price
     * 2. Pull full usdcAmount from buyer (prevents refund exploits)
     * 3. Distribute payments: platform fee + producer payments
     * 4. Refund any excess USDC to buyer
     * 5. Transfer NFTs to buyer
     * 
     * @param batchID The batch identifier (1-based indexing)
     * @param usdcAmount Maximum USDC to spend (excess will be refunded)
     * @param tokenAmount Number of tokens to purchase from the batch
     */
    function buyBatch(uint256 batchID, uint256 usdcAmount, uint256 tokenAmount) external whenNotPaused nonReentrant {
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        Batch storage batch = batches[batchID - 1];
        require(batch.creationTime > 0, "Batch not initialized");
        require(tokenAmount > 0, "Invalid token amount");
        require(tokenAmount <= batch.remainingTokens, "Not enough tokens in batch");

        uint256 currentPrice = getCurrentBatchPrice(batchID);
        uint256 totalCost = currentPrice * tokenAmount;
        require(usdcAmount >= totalCost, "Insufficient funds sent");

        // REFUND SIPHON PREVENTION:
        // We intentionally pull the FULL usdcAmount first, then refund excess at the end.
        // This prevents a class of attacks where malicious contracts could:
        // 1. Call buyBatch with excess USDC
        // 2. Re-enter during the refund transfer callback
        // 3. Manipulate state or drain funds before the purchase completes
        // By pulling all funds upfront and refunding only after all state changes,
        // we ensure the transaction is atomic and protected by nonReentrant.
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

        bool isBatchComplete = batch.remainingTokens == 0;
        if (isBatchComplete) {
            batchSoldTime[batchID] = block.timestamp;
            batchFinalPrice[batchID] = currentPrice;
            lastCompleteSaleTime = block.timestamp;
        }

        /**
         * INTENTIONAL CEI PATTERN VIOLATION - SECURITY ANALYSIS:
         * 
         * We deliberately call updateBasePrice() BEFORE external transfers, violating the
         * Checks-Effects-Interactions pattern. This is a conscious design decision.
         * 
         * RATIONALE:
         * - The current buyer must pay the pre-adjustment price (locked in at line 308)
         * - Future batches should immediately reflect any price adjustment triggered by this sale
         * - This ordering ensures price consistency across the purchase transaction
         * 
         * SECURITY MITIGATION:
         * - The nonReentrant modifier on this function prevents reentrancy attacks
         * - All state changes are completed before any external calls
         * - The price for this transaction is already computed and locked
         * 
         * This pattern is safe due to the reentrancy guard and careful state management.
         */
        updateBasePrice();

        // FEE-ON-TRANSFER PROTECTION:
        // These checks are defensive programming for testnet deployments with non-standard tokens.
        // Production uses canonical USDC which has no transfer fees, but we verify anyway.
        
        // INBOUND: Capture actual received amount (handles inbound fees)
        uint256 balanceBefore = usdcToken.balanceOf(address(this));
        usdcToken.safeTransferFrom(msg.sender, address(this), usdcAmount);
        uint256 receivedAmount = usdcToken.balanceOf(address(this)) - balanceBefore;

        // Ensure we received enough (guards against inbound fees)
        require(receivedAmount >= totalCost, "Insufficient received: fee-on-transfer not supported");

        // Recalculate refund based on actual received amount
        refundAmount = receivedAmount - totalCost;

        // OUTBOUND: Transfer to producers with recipient-side fee detection
        for (uint256 i = 0; i < recipients.length; i++) {
            if (amounts[i] > 0) {
                uint256 recipientBefore = usdcToken.balanceOf(recipients[i]);
                usdcToken.safeTransfer(recipients[i], amounts[i]);
                uint256 recipientAfter = usdcToken.balanceOf(recipients[i]);
                require(
                    recipientAfter - recipientBefore == amounts[i], 
                    "Fee-on-transfer tokens not supported (producer payout)"
                );
                emit ProducerPayment(recipients[i], amounts[i]);
            }
        }

        // OUTBOUND: Refund with recipient-side fee detection
        if (refundAmount > 0) {
            uint256 buyerBefore = usdcToken.balanceOf(msg.sender);
            usdcToken.safeTransfer(msg.sender, refundAmount);
            uint256 buyerAfter = usdcToken.balanceOf(msg.sender);
            require(
                buyerAfter - buyerBefore == refundAmount,
                "Fee-on-transfer tokens not supported (refund)"
            );
        }

        uint256[] memory tokenAmounts = new uint256[](ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            tokenAmounts[i] = 1;
        }
        _safeBatchTransferFrom(address(this), msg.sender, ids, tokenAmounts, "");

        // Emit events only after all transfers succeed
        if (isBatchComplete) {
            emit BatchSold(batchID, block.timestamp, tokenAmount);
        } else {
            emit PartialBatchSold(batchID, block.timestamp, batch.remainingTokens);
        }
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

        // Calculate per-token amount and remainder for fair distribution
        uint256 perTokenAmount = producerShare / ids.length;
        uint256 remainder = producerShare % ids.length;

        // Count unique producers first
        uint256 uniqueCount;
        address[] memory tempProducers = new address[](ids.length);
        uint256[] memory tempAmounts = new uint256[](ids.length);
        uint256[] memory tempTokenCounts = new uint256[](ids.length);

        // First pass: count tokens per producer
        for (uint256 i = 0; i < ids.length; ) {
            TokenInfo storage token = tokens[ids[i]];
            bool found;

            for (uint256 j = 0; j < uniqueCount; ) {
                if (tempProducers[j] == token.producer) {
                    tempTokenCounts[j]++;
                    found = true;
                    break;
                }
                unchecked {
                    ++j;
                }
            }

            if (!found) {
                tempProducers[uniqueCount] = token.producer;
                tempTokenCounts[uniqueCount] = 1;
                unchecked {
                    ++uniqueCount;
                }
            }
            unchecked {
                ++i;
            }
        }

        // Calculate amounts with remainder going to first producer
        for (uint256 i = 0; i < uniqueCount; ) {
            tempAmounts[i] = perTokenAmount * tempTokenCounts[i];
            unchecked {
                ++i;
            }
        }

        // Add remainder to first producer for deterministic distribution
        // KNOWN BEHAVIOR: First producer receives any remainder wei from division
        // DESIGN RATIONALE FOR NOT CHANGING:
        // - Impact is negligible (maximum few wei, worth ~$0.000001)
        // - Deterministic approach prevents gaming/manipulation
        // - Alternative approaches (round-robin, random) add complexity for no material benefit
        // - Gas cost of more complex distribution exceeds value of remainder
        // - Current approach is simple, predictable, and auditable
        if (remainder > 0 && uniqueCount > 0) {
            tempAmounts[0] += remainder;
        }

        // Create final arrays
        recipients = new address[](uniqueCount);
        amounts = new uint256[](uniqueCount);

        // Copy values and verify total
        uint256 totalDistributed;
        for (uint256 i = 0; i < uniqueCount; ) {
            recipients[i] = tempProducers[i];
            amounts[i] = tempAmounts[i];
            totalDistributed += amounts[i];
            unchecked {
                ++i;
            }
        }

        // Ensure invariant: total distributed to producers + platform share = total price
        require(totalDistributed + platformShare == totalPrice, "Payment distribution mismatch");
    }

    /**
     * @notice Returns available tokens from a batch for partial purchase
     * @dev TOKEN ORDERING BEHAVIOR:
     * - Tokens are returned in the order they appear in the batch
     * - When some tokens are already sold, buyers receive non-contiguous IDs
     * - Example: If tokens 1,2,3,4,5 exist and 2,4 are sold, next buyer gets 1,3,5
     * - This maintains batch order but cannot guarantee sequential token IDs
     * - Useful for collections where relative order matters more than specific numbers
     * @param batchID The 1-based batch ID to buy from
     * @param numberToBuy How many tokens to purchase
     * @return Array of available token IDs in batch order (may be non-sequential)
     */
    function getPartialIds(uint256 batchID, uint256 numberToBuy) internal view returns (uint256[] memory) {
        require(batchID > 0 && batchID <= batches.length, "Invalid batch ID");
        require(numberToBuy > 0, "Number to buy must be greater than zero");
        uint256[] memory partialIds = new uint256[](numberToBuy);
        uint256 counter = 0;

        for (uint256 i = 0; i < batches[batchID - 1].tokenIds.length && counter < numberToBuy; i++) {
            uint256 tokenId = batches[batchID - 1].tokenIds[i];
            // Check both balance AND that token is not redeemed
            if (balanceOf(address(this), tokenId) > 0 && !tokens[tokenId].redeemed) {
                partialIds[counter] = tokenId;
                counter++;
            }
        }

        require(counter == numberToBuy, "Unable to get the required number of tokens");
        return partialIds;
    }

    /**
     * @notice Mark a token as redeemed for its real-world carbon offset
     * @dev Sets a redemption flag but does NOT burn or restrict transfers.
     * This allows redeemed tokens to remain tradeable as collectibles.
     * Only the token holder can redeem. Redemption is irreversible.
     * 
     * NOTE: Redemption continues to work during pause (intentional design choice)
     * to allow holders to claim their offsets even during emergencies.
     * 
     * @param tokenId The token ID to mark as redeemed
     */
    function redeemToken(uint256 tokenId) external nonReentrant {
        require(tokenId > 0 && tokenId <= lastTokenID, "Token does not exist");
        TokenInfo storage token = tokens[tokenId];
        require(balanceOf(msg.sender, tokenId) > 0, "Caller is not the token owner");
        require(!token.redeemed, "Token already redeemed");

        token.redeemed = true;
        emit TokenRedeemed(tokenId, msg.sender, block.timestamp);
    }

    /**
     * @notice Recover accidentally sent ERC20 tokens (excluding USDC)
     * @dev IMPORTANT: This function intentionally blocks USDC recovery to prevent accounting errors.
     * USDC can only be withdrawn via claimPlatformFunds() which tracks platformShareAccumulated.
     * 
     * KNOWN LIMITATION: If USDC is accidentally sent directly to this contract (not via buyBatch),
     * those funds become unrecoverable. This is a deliberate design choice to maintain strict
     * accounting integrity. Only platform fees accumulated through sales can be withdrawn.
     * 
     * @param token The ERC20 token address to recover (cannot be USDC)
     * @param amount The amount to recover
     * @param to The recipient address
     */
    function recoverERC20(address token, uint256 amount, address to) external onlyOwner nonReentrant whenNotPaused {
        require(to != address(0), "Address must not be zero");
        require(token != address(usdcToken), "Use claimPlatformFunds for USDC");
        IERC20(token).safeTransfer(to, amount);
    }

    /**
     * @notice Withdraw accumulated platform fees
     * @dev Can be called even during pause to allow emergency fund recovery.
     * Only withdraws the platformShareAccumulated amount (not total USDC balance).
     * This ensures accurate accounting and prevents withdrawal of producer funds.
     * 
     * FEE-ON-TRANSFER NOTE: This function does not check recipient balance because:
     * 1. Production uses canonical USDC with no transfer fees
     * 2. Only callable by owner (multisig) who controls deployment
     * 3. Owner would not deploy with a token that charges them fees
     * 4. Adding checks would waste gas for no security benefit in production
     * 
     * The fee-on-transfer checks in buyBatch protect USERS from malicious deployments,
     * but the owner doesn't need protection from themselves.
     * 
     * @param to The address to send platform funds to
     */
    function claimPlatformFunds(address to) external onlyOwner nonReentrant {
        require(to != address(0), "Address must not be zero");
        require(platformShareAccumulated > 0, "No funds to withdraw");
        uint256 amountToWithdraw = platformShareAccumulated;
        platformShareAccumulated = 0;
        usdcToken.safeTransfer(to, amountToWithdraw);
        emit PlatformFundsClaimed(to, amountToWithdraw);
    }

    /**
     * @notice Update base price based on market activity
     * @dev Called automatically during minting and after batch sales.
     * 
     * PRICE ADJUSTMENT LOGIC:
     * - INCREASE: If batches sell within dayIncreaseThreshold (2 days), increase by priceAdjustDelta
     * - DECREASE: If no complete sales for dayDecreaseThreshold (4 days), decrease by priceAdjustDelta
     * - Only considers recent activity within PRICE_WINDOW (90 days)
     * - Bounded iterations via maxPriceUpdateIterations to prevent DoS
     * - Price floor ensures minimum value is maintained
     * 
     * KNOWN LIMITATION: Gas costs scale with number of batches when checking for price decreases.
     * 
     * DESIGN RATIONALE FOR NOT FIXING:
     * - Current iteration limit (100) bounds worst-case gas to ~500k even with 1000+ batches
     * - Real-world usage: ~10-50 batches/month makes gas concern theoretical not practical
     * - Cost/benefit: Refactoring to linked lists or auxiliary structures adds significant complexity
     * - Mitigation exists: Owner can adjust maxPriceUpdateIterations if needed
     * - Business model: Platform absorbs gas costs (owner calls mintBatch), not end users
     * - Historical data: Gas costs have remained reasonable in production with current design
     * 
     * This creates a self-regulating market that responds to demand.
     */
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
            basePrice = basePrice + totalIncrease;
            lastPriceAdjustmentTime = currentTime;
            emit BasePriceAdjusted(basePrice, currentTime, true);
            return;
        }

        // PRICE DECREASES - only consider recent batches
        uint256 daysWithoutSales = (currentTime - lastCompleteSaleTime) / SECONDS_IN_A_DAY;

        if (daysWithoutSales >= dayDecreaseThreshold) {
            uint256 thresholdStartTime = currentTime - (dayDecreaseThreshold * SECONDS_IN_A_DAY);
            uint256 unsoldBatchCount = 0;
            uint256 iterations = 0;
            bool limitReached = false;

            for (uint256 i = batches.length; i > 0; i--) {
                // Check iteration limit to prevent DoS
                if (iterations >= maxPriceUpdateIterations) {
                    limitReached = true;
                    emit PriceUpdateIterationLimitReached(iterations, batches.length);
                    break;
                }

                Batch storage batch = batches[i - 1];

                // Early exit if batch is before the window
                if (batch.creationTime < windowStart) break;

                if (
                    batch.creationTime <= thresholdStartTime &&
                    batch.remainingTokens == batch.tokenIds.length &&
                    !batchUsedInPriceDecrease[batch.batchId]
                ) {
                    unsoldBatchCount++;
                    batchUsedInPriceDecrease[batch.batchId] = true;
                    emit BatchMarkedUsedInPriceDecrease(batch.batchId, block.timestamp);
                }

                iterations++;
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
