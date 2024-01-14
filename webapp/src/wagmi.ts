import { getDefaultConfig } from "connectkit";
import { configureChains, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";

const walletConnectProjectId = "0ae1a048225917dfb3d8047f884465f1";
const alchemyAPIKey = "iLBP5cYsA21h9sQw1rBl9_n7sng_zlMZ";
const nodeHTTPSURL = "https://base-sepolia.g.alchemy.com/v2/";
const nodeWSSURL = "wss://base-sepolia.g.alchemy.com/v2/";

const isDev = true;
console.log("wagmi: development mode", isDev);
const chain = isDev ? baseSepolia : base;
console.log("wagmi: connecting to chain chain", chain);

export const config = createConfig(
  getDefaultConfig({
    autoConnect: true,
    appName: "Asta Verde",
    walletConnectProjectId,
    chains: [chain],
    alchemyId: alchemyAPIKey,
  })
);
