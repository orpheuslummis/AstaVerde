import { getDefaultConfig } from "connectkit";
import { createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import {
    ALCHEMY_API_KEY,
    CHAIN_SELECTION,
    WALLET_CONNECT_PROJECT_ID,
} from "./app.config";

const chains = (() => {
    switch (CHAIN_SELECTION) {
        case "base_mainnet":
            return [base] as const;
        case "base_sepolia":
        default:
            return [
                {
                    ...baseSepolia,
                    rpcUrls: {
                        default: {
                            http: [
                                `https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
                            ],
                        },
                    },
                },
            ] as const;
    }
})();

export const config = createConfig(
    getDefaultConfig({
        appName: "Asta Verde",
        walletConnectProjectId: WALLET_CONNECT_PROJECT_ID,
        chains,
    }),
);
