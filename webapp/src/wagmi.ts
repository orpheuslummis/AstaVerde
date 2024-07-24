import { getDefaultConfig } from "connectkit";
import { createConfig, http } from "wagmi";
import { base, baseSepolia, hardhat } from "wagmi/chains";
import {
  ALCHEMY_API_KEY,
  CHAIN_SELECTION,
  WALLET_CONNECT_PROJECT_ID
} from "./app.config";

// Define the chains we want to support
const chains = (() => {
  switch (CHAIN_SELECTION) {
    case "base_sepolia":
      return [baseSepolia] as const;
    case "base_mainnet":
      return [base] as const;
    case "local":
    default:
      return [baseSepolia] as const;
  }
})();

// Create the Wagmi config using ConnectKit's getDefaultConfig
export const config = createConfig(
  getDefaultConfig({
    // Required
    appName: "Asta Verde",
    walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,

    // Required
    chains,

    // Configure transports
    transports: Object.fromEntries(
      chains.map((chain) => [
        chain.id,
        http(
          chain.id === hardhat.id
            ? 'http://localhost:8545' // Use explicit URL for Hardhat
            : `https://${chain.id === base.id ? 'base-mainnet' : 'base-sepolia'}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`
        )
      ])
    ),

    // Optional
    // appDescription: "Your App Description",
    // appUrl: "https://your-app-url.com",
    // appIcon: "https://your-app-icon-url.com",
  })
);