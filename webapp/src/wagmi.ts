import { getDefaultConfig } from "connectkit";
import { Chain, createConfig } from "wagmi";
import { base, baseSepolia, hardhat } from "wagmi/chains";
import { ALCHEMY_API_KEY, WALLET_CONNECT_PROJECT_ID } from "./app.config";

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
    walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
    chains: [chain],
    alchemyId: ALCHEMY_API_KEY,
  }),
);
