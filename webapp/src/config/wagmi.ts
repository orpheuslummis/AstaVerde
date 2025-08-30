import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { getConfiguredChains, isLocalDevelopment } from "./chains";
import { ENV } from "./environment";
import { mockConnector } from "../lib/mock-connector";

// Get chains for configuration
const chains = getConfiguredChains();

// Check if we're in E2E test mode
const isE2EMode =
  typeof window !== "undefined" &&
  (window.location.search.includes("e2e=true") || localStorage.getItem("e2e-mode") === "true");

// Configure wallet connection
// For local development, don't use WalletConnect to avoid connection errors
const baseConfig = isLocalDevelopment()
  ? {
      appName: "Asta Verde",
      chains,
    }
  : {
      appName: "Asta Verde",
      walletConnectProjectId: ENV.WALLET_CONNECT_PROJECT_ID,
      chains,
    };

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
  // Normal mode: Use default config (filter out Coinbase)
  const defaultConfig = getDefaultConfig(baseConfig as Parameters<typeof getDefaultConfig>[0]);
  wagmiConfig = createConfig({
    ...defaultConfig,
    connectors: (defaultConfig.connectors || []).filter((c) => c?.id !== "coinbaseWallet"),
  });
}

export { wagmiConfig };
