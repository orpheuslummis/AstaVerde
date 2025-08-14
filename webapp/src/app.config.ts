export const CHAIN_OPTIONS = ["local", "base_sepolia", "base_mainnet"] as const;
export type ChainSelection = (typeof CHAIN_OPTIONS)[number];

export const USDC_DECIMALS = Number(process.env.NEXT_PUBLIC_USDC_DECIMALS) || 6;

const rawIpfsGatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL;
export const IPFS_GATEWAY_URL = rawIpfsGatewayUrl
    ? rawIpfsGatewayUrl.endsWith("/")
        ? rawIpfsGatewayUrl
        : `${rawIpfsGatewayUrl}/`
    : "https://ipfs.io/ipfs/";

// Specific gateway for web3.storage if needed as a targeted fallback
export const WEB3_STORAGE_GATEWAY_HOST_CONSTRUCTION = true; // Flag to indicate special construction
export const WEB3_STORAGE_GATEWAY_PREFIX = "https://";
export const WEB3_STORAGE_GATEWAY_SUFFIX = ".ipfs.w3s.link/";

export const FALLBACK_IPFS_GATEWAY_URL = "https://dweb.link/ipfs/"; // General public fallback (third attempt)

export const ASTAVERDE_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS || "";

// Define CHAIN_SELECTION before using it
export const CHAIN_SELECTION = (process.env.NEXT_PUBLIC_CHAIN_SELECTION || "base_sepolia") as ChainSelection;

// USDC addresses by network
export const USDC_ADDRESS =
    CHAIN_SELECTION === "base_mainnet"
        ? process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" // Native Circle USDC on Base
        : process.env.NEXT_PUBLIC_USDC_ADDRESS || "";

export const ECOSTABILIZER_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_ECOSTABILIZER_ADDRESS || "";
export const SCC_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_SCC_ADDRESS || "";
export const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;
export const WALLET_CONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "";
export const IPFS_PREFIX = "ipfs://";
export const EXTERNAL_URL = "https://ecotradezone.bionerg.com/token/";

export const navigationLinks = [
    { name: "Market", url: "/" },
    { name: "My Eco Assets", url: "/mytokens" },
    { name: "About Eco Assets", url: "/ecoassets" },
    { name: "About", url: "/about" },
];

function validateConfig(): void {
    if (!USDC_ADDRESS || !ASTAVERDE_CONTRACT_ADDRESS) {
        throw new Error(
            `USDC_ADDRESS and ASTAVERDE_CONTRACT_ADDRESS must be set for CHAIN_SELECTION: ${CHAIN_SELECTION}`,
        );
    }
    if (!ALCHEMY_API_KEY || !WALLET_CONNECT_PROJECT_ID) {
        throw new Error("ALCHEMY_API_KEY and WALLET_CONNECT_PROJECT_ID must be set");
    }
    if (!IPFS_GATEWAY_URL) {
        throw new Error("IPFS_GATEWAY_URL must be set");
    }
    // Note: EcoStabilizer and SCC addresses are optional for backward compatibility
    // They will be checked when vault features are used
}

validateConfig();

function logAppConfig() {
    console.log("App Configuration:", {
        CHAIN_SELECTION,
        ASTAVERDE_CONTRACT_ADDRESS,
        USDC_ADDRESS,
        ECOSTABILIZER_CONTRACT_ADDRESS,
        SCC_CONTRACT_ADDRESS,
        IPFS_GATEWAY_URL,
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_CHAIN_SELECTION: process.env.NEXT_PUBLIC_CHAIN_SELECTION,
        NEXT_PUBLIC_ASTAVERDE_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS,
        NEXT_PUBLIC_USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS,
        NEXT_PUBLIC_ECOSTABILIZER_ADDRESS: process.env.NEXT_PUBLIC_ECOSTABILIZER_ADDRESS,
        NEXT_PUBLIC_SCC_ADDRESS: process.env.NEXT_PUBLIC_SCC_ADDRESS,
    });
}

logAppConfig();
