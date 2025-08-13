import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { getConfiguredChains, isLocalDevelopment } from "./chains";
import { ENV } from "./environment";
import { mockConnector } from "../lib/mock-connector";

// Get chains for configuration
const chains = getConfiguredChains();

// Check if we're in E2E test mode
const isE2EMode = typeof window !== 'undefined' && (
    window.location.search.includes('e2e=true') ||
    localStorage.getItem('e2e-mode') === 'true'
);

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

// Create wagmi config with mock connector for E2E testing
let wagmiConfig: any;

if (isE2EMode && isLocalDevelopment()) {
    // E2E mode: Add mock connector to the config
    wagmiConfig = createConfig({
        chains,
        connectors: [
            mockConnector(),
            ...getDefaultConfig(baseConfig as any).connectors || []
        ],
        transports: chains.reduce((acc, chain) => {
            acc[chain.id] = http();
            return acc;
        }, {} as any),
    });
} else {
    // Normal mode: Use default config
    wagmiConfig = createConfig(getDefaultConfig(baseConfig as any));
}

export { wagmiConfig };
