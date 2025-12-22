import { arbitrum, arbitrumSepolia, base, baseSepolia } from "wagmi/chains";
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

function buildHttpUrls(
  overrideUrl: string,
  alchemyUrl: string | undefined,
  fallback: readonly string[],
): readonly string[] {
  if (overrideUrl) {
    return [overrideUrl];
  }
  if (alchemyUrl) {
    return [alchemyUrl];
  }
  return fallback;
}

const baseMainnetRpc = buildHttpUrls(
  ENV.BASE_MAINNET_RPC_URL,
  ENV.ALCHEMY_API_KEY ? `https://base-mainnet.g.alchemy.com/v2/${ENV.ALCHEMY_API_KEY}` : undefined,
  base.rpcUrls.default.http,
);
const baseSepoliaRpc = buildHttpUrls(
  ENV.BASE_SEPOLIA_RPC_URL,
  ENV.ALCHEMY_API_KEY ? `https://base-sepolia.g.alchemy.com/v2/${ENV.ALCHEMY_API_KEY}` : undefined,
  baseSepolia.rpcUrls.default.http,
);
const arbitrumMainnetRpc = buildHttpUrls(
  ENV.ARBITRUM_MAINNET_RPC_URL,
  ENV.ALCHEMY_API_KEY ? `https://arb-mainnet.g.alchemy.com/v2/${ENV.ALCHEMY_API_KEY}` : undefined,
  arbitrum.rpcUrls.default.http,
);
const arbitrumSepoliaRpc = buildHttpUrls(
  ENV.ARBITRUM_SEPOLIA_RPC_URL,
  ENV.ALCHEMY_API_KEY ? `https://arb-sepolia.g.alchemy.com/v2/${ENV.ALCHEMY_API_KEY}` : undefined,
  arbitrumSepolia.rpcUrls.default.http,
);

// Chain configurations with custom RPC endpoints
export const chainConfigs = {
  base_mainnet: {
    ...base,
    rpcUrls: {
      default: { http: baseMainnetRpc },
      public: { http: baseMainnetRpc },
    },
  },
  base_sepolia: {
    ...baseSepolia,
    rpcUrls: {
      default: { http: baseSepoliaRpc },
      public: { http: baseSepoliaRpc },
    },
  },
  arbitrum_mainnet: {
    ...arbitrum,
    rpcUrls: {
      default: { http: arbitrumMainnetRpc },
      public: { http: arbitrumMainnetRpc },
    },
  },
  arbitrum_sepolia: {
    ...arbitrumSepolia,
    rpcUrls: {
      default: { http: arbitrumSepoliaRpc },
      public: { http: arbitrumSepoliaRpc },
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
  return (
    ENV.CHAIN_SELECTION === "base_sepolia" ||
    ENV.CHAIN_SELECTION === "arbitrum_sepolia" ||
    ENV.CHAIN_SELECTION === "local"
  );
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
    case "arbitrum_mainnet":
      return "Arbitrum One";
    case "arbitrum_sepolia":
      return "Arbitrum Sepolia";
    case "local":
      return "Local Network";
    default:
      return "Unknown Network";
  }
}
