// Environment variables configuration
// Centralized location for all environment variable access

export const ENV = {
  // Chain configuration
  CHAIN_SELECTION: (process.env.NEXT_PUBLIC_CHAIN_SELECTION || "arbitrum_sepolia") as ChainSelection,

  // Contract addresses - single system (new)
  ASTAVERDE_ADDRESS: process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS || "",
  USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
  ECOSTABILIZER_ADDRESS: process.env.NEXT_PUBLIC_ECOSTABILIZER_ADDRESS || "",
  SCC_ADDRESS: process.env.NEXT_PUBLIC_SCC_ADDRESS || "",

  // API Keys
  ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",

  // IPFS Configuration
  // Default to Web3.Storage's public gateway (path-style); env can override.
  IPFS_GATEWAY_URL: process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || "https://w3s.link/ipfs/",

  // Token Configuration
  USDC_DECIMALS: Number(process.env.NEXT_PUBLIC_USDC_DECIMALS) || 6,

  // Debug controls (browser-exposed)
  DEBUG: (process.env.NEXT_PUBLIC_DEBUG || "false").toLowerCase() === "true",
} as const;

export const CHAIN_OPTIONS = ["local", "base_sepolia", "base_mainnet", "arbitrum_sepolia", "arbitrum_mainnet"] as const;
export type ChainSelection = (typeof CHAIN_OPTIONS)[number];

// Validate required environment variables
export function validateEnvironment(): void {
  const required = [
    "ASTAVERDE_ADDRESS",
    "USDC_ADDRESS",
    "ECOSTABILIZER_ADDRESS",
    "SCC_ADDRESS",
    "ALCHEMY_API_KEY",
  ];

  const missing = required.filter((key) => !ENV[key as keyof typeof ENV]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` + "Please check your .env.local file",
    );
  }

  // All addresses are required in the single-system setup
}

// Helper: whether WalletConnect can be enabled
export function hasWalletConnectProjectId(): boolean {
  const id = (ENV.WALLET_CONNECT_PROJECT_ID || "").trim();
  // Treat placeholder values (e.g., "demo") or malformed IDs as not configured.
  // WalletConnect Cloud project IDs are 32 hex chars.
  const isValidHex32 = /^[0-9a-fA-F]{32}$/.test(id);
  return isValidHex32;
}
