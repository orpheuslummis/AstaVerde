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

export const CHAIN_SELECTION = process.env.NEXT_PUBLIC_CHAIN_SELECTION ||
  process.env.CHAIN_SELECTION || "local";
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

export const USDC_ADDRESS =
  process.env[`USDC_ADDRESS_${CHAIN_SELECTION.toUpperCase()}`];
export const ASTAVERDE_ADDRESS =
  process.env[`ASTAVERDE_ADDRESS_${CHAIN_SELECTION.toUpperCase()}`];
if (!USDC_ADDRESS || !ASTAVERDE_ADDRESS) {
  throw new Error("USDC_ADDRESS and ASTAVERDE_ADDRESS must be set");
}

export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
export const WALLET_CONNECT_PROJECT_ID =
  process.env.WALLET_CONNECT_PROJECT_ID || "";
if (!ALCHEMY_API_KEY || !WALLET_CONNECT_PROJECT_ID) {
  throw new Error("ALCHEMY_API_KEY and WALLET_CONNECT_PROJECT_ID must be set");
}
