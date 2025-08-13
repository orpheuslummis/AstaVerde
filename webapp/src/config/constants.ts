// Application constants
// Non-environment specific configuration values

// IPFS Configuration
export const IPFS_PREFIX = "ipfs://";
export const WEB3_STORAGE_GATEWAY_HOST_CONSTRUCTION = true;
export const WEB3_STORAGE_GATEWAY_PREFIX = "https://";
export const WEB3_STORAGE_GATEWAY_SUFFIX = ".ipfs.w3s.link/";
export const FALLBACK_IPFS_GATEWAY_URL = "https://dweb.link/ipfs/";

// External URLs
export const EXTERNAL_URL = "https://ecotradezone.bionerg.com/token/";

// Navigation
export const navigationLinks = [
    { name: "Market", url: "/" },
    { name: "My Eco Assets", url: "/mytokens" },
    { name: "About Eco Assets", url: "/ecoassets" },
    { name: "About", url: "/about" },
] as const;

// Contract Function Names
export const READ_ONLY_FUNCTIONS = [
    "uri",
    "balanceOf",
    "lastTokenID",
    "tokens",
    "getCurrentBatchPrice",
    "getBatchInfo",
    "lastBatchID",
    "platformShareAccumulated",
    "basePrice",
    "priceFloor",
    "priceDelta",
    "priceDecreaseRate",
    "dayIncreaseThreshold",
    "dayDecreaseThreshold",
    "lastPriceChangeTime",
    "pricingInfo",
    "maxBatchSize",
    "platformSharePercentage",
    "supportsInterface",
    "tokenOfOwnerByIndex",
    "dailyPriceDecay",
    "priceAdjustDelta",
] as const;

export const WRITE_FUNCTIONS = [
    "updateBasePrice",
    "mintBatch",
    "buyBatch",
    "redeemToken",
    "claimPlatformFunds",
    "pause",
    "unpause",
    "setURI",
    "setPriceFloor",
    "setBasePrice",
    "setMaxBatchSize",
    "setAuctionDayThresholds",
    "setPlatformSharePercentage",
    "mint",
    "setPriceDelta",
    "setDailyPriceDecay",
] as const;

// Vault Constants
export const SCC_PER_ASSET = 20n * 10n ** 18n; // 20 SCC with 18 decimals
export const VAULT_GAS_LIMITS = {
    DEPOSIT: 150_000n,
    WITHDRAW: 120_000n,
} as const;

// Batch Operations
export const BATCH_SIZE_FOR_TOKEN_QUERY = 500;
export const APPROVAL_BUFFER_FACTOR = 100n;

// Transaction Settings
export const TX_CONFIRMATION_TIMEOUT = 30_000; // 30 seconds
export const TX_RETRY_COUNT = 3;
export const TX_RETRY_DELAY = 5_000; // 5 seconds
