import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";
import "./tasks/fund-account";
import "./tasks/query";

// Load public environment variables
dotenvConfig({ path: resolve(__dirname, ".env") });

// Load private environment variables
dotenvConfig({ path: resolve(__dirname, ".env.local") });

const mnemonic: string | undefined = process.env.MNEMONIC;
const privateKey: string | undefined = process.env.PRIVATE_KEY;
const rpcApiKey: string | undefined = process.env.RPC_API_KEY;
const ownerAddress: string | undefined = process.env.OWNER_ADDRESS;

const chainIds = {
    hardhat: 31337,
    "base-sepolia": 84532,
    "base-mainnet": 8453,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
    let jsonRpcUrl: string;
    switch (chain) {
        case "hardhat":
            jsonRpcUrl = "http://localhost:8545";
            break;
        case "base-mainnet":
            jsonRpcUrl = `https://base-mainnet.g.alchemy.com/v2/${rpcApiKey}`;
            break;
        case "base-sepolia":
            jsonRpcUrl = `https://base-sepolia.g.alchemy.com/v2/${rpcApiKey}`;
            break;
        default:
            jsonRpcUrl = "";
    }

    if (!jsonRpcUrl) {
        throw new Error(`No RPC URL specified for chain ${chain}`);
    }

    return {
        accounts: {
            count: 10,
            mnemonic,
            path: "m/44'/60'/0'/0",
        },
        chainId: chainIds[chain],
        url: jsonRpcUrl,
    };
}

const config: HardhatUserConfig = {
    defaultNetwork: "hardhat",
    namedAccounts: {
        deployer: 0,
    },
    networks: {
        hardhat: {
            accounts: {
                mnemonic,
            },
            chainId: chainIds.hardhat,
            mining: {
                auto: true,
                interval: 0,
            },
        },
        "base-mainnet": {
            ...getChainConfig("base-mainnet"),
            accounts: [privateKey as string],
            verify: {
                etherscan: {
                    apiKey: process.env.BASE_MAINNET_EXPLORER_API_KEY,
                },
            },
            timeout: 300000, // 5 minutes
        },
        "base-sepolia": {
            ...getChainConfig("base-sepolia"),
            accounts: [privateKey as string],
            verify: {
                etherscan: {
                    apiKey: process.env.BASE_SEPOLIA_EXPLORER_API_KEY,
                },
            },
            timeout: 300000, // 5 minutes
        },
    },
    etherscan: {
        apiKey: {
            "base-sepolia": process.env.BASE_SEPOLIA_EXPLORER_API_KEY!,
        },
        customChains: [
            {
                network: "base-sepolia",
                chainId: 84532,
                urls: {
                    apiURL: "https://base-sepolia.blockscout.com/api",
                    browserURL: "https://base-sepolia.blockscout.com",
                },
            },
        ],
    },
    paths: {
        artifacts: "./artifacts",
        cache: "./cache",
        sources: "./contracts",
        tests: "./test",
    },
    solidity: {
        version: "0.8.27",
        settings: {
            metadata: {
                bytecodeHash: "none",
            },
            optimizer: {
                enabled: true,
                runs: 800,
            },
        },
    },
    typechain: {
        outDir: "types",
        target: "ethers-v6",
    },
};

export const mintingConfig = {
    contractAddress: process.env.CONTRACT_ADDRESS,
    imageFolder: process.env.IMAGE_FOLDER,
    csvPath: process.env.CSV_PATH,
    email: process.env.EMAIL,
};

export const deploymentConfig = {
    ownerAddress: process.env.OWNER_ADDRESS || undefined,
};

export default config;
