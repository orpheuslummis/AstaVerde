import { base, baseSepolia } from "wagmi/chains";
import { ENV } from "./environment";
import type { Chain } from "wagmi/chains";

// Custom local chain configuration with explicit RPC URL
const localChain: Chain = {
  id: 31337,
  name: "Hardhat",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
    },
    public: {
      http: ["http://127.0.0.1:8545"],
    },
  },
  testnet: true,
};

// Chain configurations with custom RPC endpoints
export const chainConfigs = {
  base_mainnet: {
    ...base,
    rpcUrls: {
      default: {
        http: [`https://base-mainnet.g.alchemy.com/v2/${ENV.ALCHEMY_API_KEY}`],
      },
    },
  },
  base_sepolia: {
    ...baseSepolia,
    rpcUrls: {
      default: {
        http: [`https://base-sepolia.g.alchemy.com/v2/${ENV.ALCHEMY_API_KEY}`],
      },
    },
  },
  local: localChain,
} as const;

// Get the current chain configuration
export function getCurrentChain(): Chain {
  const chain = chainConfigs[ENV.CHAIN_SELECTION];
  if (!chain) {
    throw new Error(`Unsupported chain selection: ${ENV.CHAIN_SELECTION}`);
  }
  return chain;
}

// Get all configured chains (for wallet connection)
export function getConfiguredChains(): readonly [Chain, ...Chain[]] {
  return [getCurrentChain()] as const;
}

// Check if we're on a testnet
export function isTestnet(): boolean {
  return ENV.CHAIN_SELECTION === "base_sepolia" || ENV.CHAIN_SELECTION === "local";
}

// Check if we're on local development
export function isLocalDevelopment(): boolean {
  return ENV.CHAIN_SELECTION === "local";
}

// Get chain name for display
export function getChainDisplayName(): string {
  switch (ENV.CHAIN_SELECTION) {
    case "base_mainnet":
      return "Base";
    case "base_sepolia":
      return "Base Sepolia";
    case "local":
      return "Local Network";
    default:
      return "Unknown Network";
  }
}
