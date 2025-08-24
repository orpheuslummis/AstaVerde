// Environment variables configuration
// Centralized location for all environment variable access

export const ENV = {
  // Chain configuration
  CHAIN_SELECTION: (process.env.NEXT_PUBLIC_CHAIN_SELECTION || "base_sepolia") as ChainSelection,

  // Contract addresses - V1 (original)
  ASTAVERDE_ADDRESS: process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS || "",
  ASTAVERDE_V11_ADDRESS: process.env.NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS || "",
  USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS || "",
  ECOSTABILIZER_ADDRESS: process.env.NEXT_PUBLIC_ECOSTABILIZER_ADDRESS || "",
  ECOSTABILIZER_V11_ADDRESS: process.env.NEXT_PUBLIC_ECOSTABILIZER_V11_ADDRESS || "",
  SCC_ADDRESS: process.env.NEXT_PUBLIC_SCC_ADDRESS || "",

  // Contract addresses - V1.1 (hardened version)
  ASTAVERDE_V11_ADDRESS: process.env.NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS || "",
  ECOSTABILIZER_V11_ADDRESS: process.env.NEXT_PUBLIC_ECOSTABILIZER_V11_ADDRESS || "",

  // API Keys
  ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  WALLET_CONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "",

  // IPFS Configuration
  IPFS_GATEWAY_URL: process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || "https://ipfs.io/ipfs/",

  // Token Configuration
  USDC_DECIMALS: Number(process.env.NEXT_PUBLIC_USDC_DECIMALS) || 6,
} as const;

export const CHAIN_OPTIONS = ["local", "base_sepolia", "base_mainnet"] as const;
export type ChainSelection = (typeof CHAIN_OPTIONS)[number];

// Validate required environment variables
export function validateEnvironment(): void {
  const required = ["ASTAVERDE_ADDRESS", "USDC_ADDRESS", "ALCHEMY_API_KEY", "WALLET_CONNECT_PROJECT_ID"];

  const missing = required.filter((key) => !ENV[key as keyof typeof ENV]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` + "Please check your .env.local file",
    );
  }

  // Vault addresses are optional (Phase 2)
  if (ENV.ECOSTABILIZER_ADDRESS && !ENV.SCC_ADDRESS) {
    // eslint-disable-next-line no-console
    console.warn("EcoStabilizer address is set but SCC address is missing");
  }

  if (!ENV.ECOSTABILIZER_ADDRESS && ENV.SCC_ADDRESS) {
    // eslint-disable-next-line no-console
    console.warn("SCC address is set but EcoStabilizer address is missing");
  }
}
