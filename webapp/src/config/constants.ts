// Application constants
// Non-environment specific configuration values

// IPFS Configuration
export const IPFS_PREFIX = "ipfs://";
export const WEB3_STORAGE_GATEWAY_HOST_CONSTRUCTION = true;
export const WEB3_STORAGE_GATEWAY_PREFIX = "https://";
export const WEB3_STORAGE_GATEWAY_SUFFIX = ".ipfs.w3s.link/";
export const FALLBACK_IPFS_GATEWAY_URL = "https://dweb.link/ipfs/";
export const CLOUDFLARE_IPFS_GATEWAY_URL = "https://cloudflare-ipfs.com/ipfs/";

// External URLs
export const EXTERNAL_URL = "https://ecotradezone.bionerg.com/token/";

// Navigation
export const navigationLinks = [
  { name: "Market", url: "/" },
  { name: "My Eco Assets", url: "/mytokens" },
  { name: "About Eco Assets", url: "/ecoassets" },
  { name: "About", url: "/about" },
] as const;

// Contract Function Names (deprecated)
// Static allowlists removed in favor of ABI-driven inference.

// Vault Constants
export const SCC_PER_ASSET = 20n * 10n ** 18n; // 20 SCC with 18 decimals
export const VAULT_GAS_LIMITS = {
  // Per AGENTS.md (2025-08-27): current target ~215k, cap 230k
  DEPOSIT: 230_000n,
  WITHDRAW: 120_000n,
} as const;

// Batch Operations
export const BATCH_SIZE_FOR_TOKEN_QUERY = 500;
export const APPROVAL_BUFFER_FACTOR = 100n;

// Transaction Settings
// Receipt polling budget, sized for Ethereum L1 (~12 s blocks).
// A normally-priced tx confirms in 1-5 blocks (12-60 s); an underpriced one can
// sit in the mempool for minutes. These control how long we POLL for a receipt,
// never whether we re-send: the tx is already broadcast by the time we wait.
// Total budget = 3 x 60 s + 2 x 5 s = 190 s (~3.2 min) before we tell the user
// the tx is still pending.
export const TX_CONFIRMATION_TIMEOUT = 60_000; // 60 seconds per polling attempt
export const TX_RETRY_COUNT = 3;
export const TX_RETRY_DELAY = 5_000; // 5 seconds between polling attempts

// Outcomes of the receipt wait, kept here so the UI can tell "still pending"
// (not a failure) apart from a genuine on-chain revert.
export const TX_REVERTED_MESSAGE = "Transaction reverted on-chain.";
export const TX_STILL_PENDING_MESSAGE =
  "Transaction is still pending after 3 minutes. It may still confirm - check your wallet or a block explorer before retrying.";
