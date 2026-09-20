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

// Contract Function Names (deprecated)
// Static allowlists removed in favor of ABI-driven inference.

// Vault Constants
export const SCC_PER_ASSET = 20n * 10n ** 18n; // 20 SCC with 18 decimals
export const VAULT_GAS_LIMITS = {
  // Fallback gas LIMITS used only when estimateContractGas fails. AGENTS.md's
  // "deposit <230k / withdraw <120k" are contract efficiency targets, not limits:
  // a limit is a ceiling and unused gas is refunded, so it is sized above the
  // measured worst case, not at it. Underestimating burns the whole limit on an
  // out-of-gas revert, which on L1 costs real ETH.
  // Measured (REPORT_GAS=true npx hardhat test, this tree):
  //   deposit  167,170 - 215,670  ->  215,670 x 1.3 = 280,371
  //   withdraw 110,596 - 121,548  ->  121,548 x 1.3 = 158,012
  DEPOSIT: 280_000n,
  WITHDRAW: 160_000n,
} as const;

// Batch Operations
export const BATCH_SIZE_FOR_TOKEN_QUERY = 500;
// USDC allowance granted when a purchase needs approval, as a multiple of that purchase.
// 2x lets a buyer make a second purchase of the same size without a new approval while
// keeping the standing allowance small (the previous 100x left a 23,000 USDC allowance
// after a single 230 USDC buy, which wallets flag and which is oversized on mainnet).
export const APPROVAL_BUFFER_FACTOR = 2n;

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
// Buy preflight verdicts. These are user-facing outcomes of a SUCCESSFUL read,
// not RPC failures, so they propagate to the caller and the toast verbatim.
export const MARKETPLACE_PAUSED_MESSAGE = "Marketplace is paused. Please try again later.";
export const INSUFFICIENT_INVENTORY_MESSAGE = "Not enough tokens available in this batch";

export const TX_STILL_PENDING_MESSAGE =
  "Transaction is still pending after 3 minutes. It may still confirm - check your wallet or a block explorer before retrying.";
