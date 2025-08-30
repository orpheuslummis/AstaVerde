import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { getConfiguredChains, isLocalDevelopment } from "./chains";
import { ENV, hasWalletConnectProjectId } from "./environment";
import { mockConnector } from "../lib/mock-connector";

// Get chains for configuration
const chains = getConfiguredChains();

// Check if we're in E2E test mode
const isE2EMode =
  typeof window !== "undefined" &&
  (window.location.search.includes("e2e=true") || localStorage.getItem("e2e-mode") === "true");

// Configure wallet connection
// For local development, don't use WalletConnect to avoid connection errors
const hasWC = hasWalletConnectProjectId();
const baseConfig = isLocalDevelopment()
  ? ({
    appName: "Asta Verde",
    chains,
  } as const)
  : (hasWC
    ? ({
      appName: "Asta Verde",
      walletConnectProjectId: ENV.WALLET_CONNECT_PROJECT_ID,
      chains,
    } as const)
    : ({
      appName: "Asta Verde",
      chains,
    } as const));

// Create wagmi config with explicit transports
let wagmiConfig: ReturnType<typeof createConfig>;

if (isE2EMode && isLocalDevelopment()) {
  // E2E mode: Add mock connector to the config (filter out Coinbase)
  const defaultConfig = getDefaultConfig(baseConfig as Parameters<typeof getDefaultConfig>[0]);
  const connectors = [mockConnector(), ...(defaultConfig.connectors || [])].filter((c) => c?.id !== "coinbaseWallet");
  wagmiConfig = createConfig({
    chains,
    connectors,
    transports: chains.reduce((acc, chain) => {
      acc[chain.id] = http("http://127.0.0.1:8545");
      return acc;
    }, {}),
  });
} else if (isLocalDevelopment()) {
  // Local development: Use explicit transport for local chain (filter out Coinbase)
  const defaultConfig = getDefaultConfig(baseConfig as Parameters<typeof getDefaultConfig>[0]);
  wagmiConfig = createConfig({
    ...defaultConfig,
    connectors: (defaultConfig.connectors || []).filter((c) => c?.id !== "coinbaseWallet"),
    transports: {
      31337: http("http://127.0.0.1:8545"),
    },
  });
} else {
  // Normal mode (~Sepolia/Mainnet)
  if (hasWC) {
    // Use ConnectKit defaults when a valid WC project ID exists
    const defaultConfig = getDefaultConfig(baseConfig as Parameters<typeof getDefaultConfig>[0]);
    wagmiConfig = createConfig({
      ...defaultConfig,
      // Filter out Coinbase; keep WC + Injected
      connectors: (defaultConfig.connectors || []).filter((c) => c?.id !== "coinbaseWallet"),
    });
  } else {
    // No WC project ID: build a minimal, stable connector set to avoid WC runtime errors
    // Use only Injected connector; explicitly force HTTP transports.
    wagmiConfig = createConfig({
      chains,
      connectors: [injected()],
      transports: chains.reduce((acc, chain) => {
        const url = chain.rpcUrls?.default?.http?.[0];
        acc[chain.id] = http(url);
        return acc;
      }, {} as Record<number, ReturnType<typeof http>>),
    });
    if (typeof window !== "undefined") {
      console.warn(
        "WalletConnect disabled: set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID to enable QR connections.",
      );
    }
  }
}

export { wagmiConfig };
