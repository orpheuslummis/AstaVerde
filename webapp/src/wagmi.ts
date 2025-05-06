import { getDefaultConfig } from "connectkit";
import { createConfig } from "wagmi";
import { base, baseSepolia, hardhat } from "wagmi/chains";
import { ALCHEMY_API_KEY, CHAIN_SELECTION, WALLET_CONNECT_PROJECT_ID } from "./app.config";

const chains = (() => {
    switch (CHAIN_SELECTION) {
        case "base_mainnet":
            return [
                {
                    ...base,
                    rpcUrls: {
                        default: {
                            http: [`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
                        },
                    },
                },
            ] as const;
        case "base_sepolia":
            return [
                {
                    ...baseSepolia,
                    rpcUrls: {
                        default: {
                            http: [`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
                        },
                    },
                },
            ] as const;
        case "local":
            return [hardhat] as const;
        default:
            throw new Error(`Unsupported chain selection: ${CHAIN_SELECTION}`);
    }
})();

export const config = createConfig(
    getDefaultConfig({
        appName: "Asta Verde",
        walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
        chains,
    }),
);
