import { getDefaultConfig } from "connectkit";
import { Chain, createConfig } from "wagmi";
import { base, baseSepolia, hardhat } from "wagmi/chains";

const alchemyAPIKey = process.env.ALCHEMY_API_KEY;
const walletConnectProjectId = process.env.WALLET_CONNECT_PROJECT_ID;
if (!alchemyAPIKey || !walletConnectProjectId) {
  throw new Error("ALCHEMY_API_KEY and WALLET_CONNECT_PROJECT_ID must be set");
}

const chainSelection = process.env.CHAIN_SELECTION;
let chain: Chain = hardhat;
switch (chainSelection) {
  case "base_sepolia":
    chain = baseSepolia;
    break;
  case "base_mainnet":
    chain = base;
    break;
}

export const config = createConfig(
  getDefaultConfig({
    autoConnect: true,
    appName: "Asta Verde",
    walletConnectProjectId,
    chains: [chain],
    alchemyId: alchemyAPIKey,
  }),
);
