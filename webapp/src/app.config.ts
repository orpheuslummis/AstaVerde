export const CHAIN_OPTIONS = ["local", "base_sepolia", "base_mainnet"] as const;
export type ChainSelection = typeof CHAIN_OPTIONS[number];

export const CHAIN_SELECTION = (process.env.NEXT_PUBLIC_CHAIN_SELECTION || "local") as ChainSelection;
export const USDC_DECIMALS = 6;
export const IPFS_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS;
export const ASTAVERDE_ADDRESS = process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS;
export const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
export const WALLET_CONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "";

export const navigationLinks = [
  { name: "Everything about EcoAssets", url: "/ecoassets" },
  { name: "Market", url: "/" },
  { name: "My EcoAssets", url: "/mytokens" },
  { name: "About", url: "/about" },
];

function validateConfig(): void {
  if (!CHAIN_OPTIONS.includes(CHAIN_SELECTION)) {
    throw new Error(
      `Invalid CHAIN_SELECTION: ${CHAIN_SELECTION}. Must be one of ${CHAIN_OPTIONS.join(", ")}`
    );
  }

  if (!USDC_ADDRESS || !ASTAVERDE_ADDRESS) {
    throw new Error(
      `USDC_ADDRESS and ASTAVERDE_ADDRESS must be set for CHAIN_SELECTION: ${CHAIN_SELECTION}`
    );
  }

  if (!ALCHEMY_API_KEY || !WALLET_CONNECT_PROJECT_ID) {
    throw new Error("ALCHEMY_API_KEY and WALLET_CONNECT_PROJECT_ID must be set");
  }
}

if (process.env.NODE_ENV === "development") {
  console.log("App config:", { CHAIN_SELECTION, USDC_DECIMALS, IPFS_GATEWAY_URL, USDC_ADDRESS, ASTAVERDE_ADDRESS, ALCHEMY_API_KEY, WALLET_CONNECT_PROJECT_ID, navigationLinks });
}

validateConfig();