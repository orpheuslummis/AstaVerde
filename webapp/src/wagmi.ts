import { infuraProvider } from "@wagmi/core/providers/infura";
// import { publicProvider } from "@wagmi/core/providers/public";
import { getDefaultConfig } from "connectkit";
// import { createPublicClient, http } from "viem";
import { configureChains, createConfig, mainnet, sepolia } from "wagmi";

// import dotenv from "dotenv";

// dotenv.config({ path: "../.env" });

const walletConnectProjectId = "0ae1a048225917dfb3d8047f884465f1";

// const infuraApiKey = process.env.INFURA_API_KEY;
const infuraApiKey = "eda31e892a144ca89dd77c572220258a";
// console.log("INFURA_API_KEY", infuraApiKey);
// if (!infuraApiKey) {
//   throw new Error("INFURA_API_KEY is not present in the environment variables.");
// }

const isDev = true;
console.log("isDev", isDev);
const chain = isDev ? sepolia : mainnet;

const { chains, publicClient } = configureChains(
  [chain],
  [infuraProvider({ apiKey: infuraApiKey })],
);

export const config = createConfig(
  getDefaultConfig({
    autoConnect: true,
    appName: "Asta Verde",
    walletConnectProjectId,
    publicClient,
    chains,
  }),
);

// export const config = createConfig({
//   autoConnect: true,
//   publicClient,
// });

// export const config = createConfig({
//   autoConnect: true,
//   publicClient: createPublicClient({
//     chain: mainnet,
//     transport: http(),
//   }),
// });

// export const config = createConfig(
//   {
//     autoConnect: true,
//     publicClient,
//     webSocketPublicClient,
//   },

// getDefaultConfig({
//   autoConnect: true,
//   appName: "Asta Verde",
//   walletConnectProjectId,
//   infuraId: infuraApiKey,
// }),
// );
