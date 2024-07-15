import dotenv from "dotenv";
dotenv.config();

export const metadata = {
  title: "wagmi",
};

export const USDC_DECIMALS = 6;

export const navigationLinks = [
  { name: "Everything about EcoAssets", url: "/ecoassets" },
  { name: "Market", url: "/" },
  { name: "My EcoAssets", url: "/mytokens" },
  { name: "About", url: "/about" },
];

export const IPFS_GATEWAY_URL = "https://gateway.pinata.cloud/ipfs/";

const CHAIN_SELECTION_ENV = process.env.NEXT_PUBLIC_CHAIN_SELECTION ||
  process.env.CHAIN_SELECTION || "local";
export const CHAIN_SELECTION = CHAIN_SELECTION_ENV as ChainSelection;
export const CHAIN_OPTIONS = ["local", "base_sepolia", "base_mainnet"] as const;
export type ChainSelection = (typeof CHAIN_OPTIONS)[number];

export function validateChainSelection(
  chain: string,
): asserts chain is ChainSelection {
  if (!CHAIN_OPTIONS.includes(chain as ChainSelection)) {
    throw new Error(
      `Invalid CHAIN_SELECTION: ${chain}. Must be one of ${
        CHAIN_OPTIONS.join(", ")
      }`,
    );
  }
}

validateChainSelection(CHAIN_SELECTION);

export const USDC_ADDRESS: string | undefined = CHAIN_SELECTION === "local"
  ? process.env.NEXT_PUBLIC_USDC_ADDRESS_LOCAL
  : CHAIN_SELECTION === "base_sepolia"
  ? process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_SEPOLIA
  : CHAIN_SELECTION === "base_mainnet"
  ? process.env.NEXT_PUBLIC_USDC_ADDRESS_BASE_MAINNET
  : undefined;

export const ASTAVERDE_ADDRESS: string | undefined = CHAIN_SELECTION === "local"
  ? process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS_LOCAL
  : CHAIN_SELECTION === "base_sepolia"
  ? process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS_BASE_SEPOLIA
  : CHAIN_SELECTION === "base_mainnet"
  ? process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS_BASE_MAINNET
  : undefined;

if (!USDC_ADDRESS || !ASTAVERDE_ADDRESS) {
  throw new Error(
    `NEXT_PUBLIC_USDC_ADDRESS and NEXT_PUBLIC_ASTAVERDE_ADDRESS must be set for CHAIN_SELECTION: ${CHAIN_SELECTION}`,
  );
}

export const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
export const WALLET_CONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "";
if (!ALCHEMY_API_KEY || !WALLET_CONNECT_PROJECT_ID) {
  throw new Error("ALCHEMY_API_KEY and WALLET_CONNECT_PROJECT_ID must be set");
}

console.log(`CHAIN_SELECTION: ${CHAIN_SELECTION}`);
console.log(`USDC_ADDRESS: ${USDC_ADDRESS}`);
console.log(`ASTAVERDE_ADDRESS: ${ASTAVERDE_ADDRESS}`);
