import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";

// Load base env first, then allow .env.local to override
dotenvConfig({ path: resolve(process.cwd(), ".env") });
dotenvConfig({ path: resolve(process.cwd(), ".env.local"), override: true });

const mnemonic: string | undefined = process.env.MNEMONIC;
const privateKey: string | undefined = process.env.PRIVATE_KEY;
const rpcApiKey: string | undefined = process.env.RPC_API_KEY;
const ownerAddress: string | undefined = process.env.OWNER_ADDRESS;
// Optional direct RPC URL overrides (prefer these in CI or when rate-limited)
const BASE_MAINNET_RPC_URL: string | undefined = process.env.BASE_MAINNET_RPC_URL;
const BASE_SEPOLIA_RPC_URL: string | undefined = process.env.BASE_SEPOLIA_RPC_URL;

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
            jsonRpcUrl = BASE_MAINNET_RPC_URL || `https://base-mainnet.g.alchemy.com/v2/${rpcApiKey}`;
            break;
        case "base-sepolia":
            jsonRpcUrl = BASE_SEPOLIA_RPC_URL || `https://base-sepolia.g.alchemy.com/v2/${rpcApiKey}`;
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
        localhost: {
            // External JSON-RPC hardhat node
            url: "http://127.0.0.1:8545",
            chainId: chainIds.hardhat,
            accounts: {
                mnemonic,
            },
        },
        "base-mainnet": {
            ...getChainConfig("base-mainnet"),
            accounts: privateKey ? [privateKey] : [],
            verify: {
                etherscan: {
                    apiKey: process.env.BASE_MAINNET_EXPLORER_API_KEY,
                },
            },
            timeout: 300000, // 5 minutes
        },
        "base-sepolia": {
            ...getChainConfig("base-sepolia"),
            accounts: privateKey ? [privateKey] : [],
            verify: {
                etherscan: {
                    apiKey: process.env.BASE_SEPOLIA_EXPLORER_API_KEY,
                },
            },
            timeout: 300000, // 5 minutes
            gasPrice: "auto",
            gasMultiplier: 1.2,
        },
    },
    etherscan: {
        apiKey: {
            "base-sepolia": process.env.BASE_SEPOLIA_EXPLORER_API_KEY!,
            base: process.env.BASE_MAINNET_EXPLORER_API_KEY!,
            // Map our network alias to the same Base mainnet key
            "base-mainnet": process.env.BASE_MAINNET_EXPLORER_API_KEY!,
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
            {
                // Ensure verification works when using network name 'base-mainnet'
                network: "base-mainnet",
                chainId: 8453,
                urls: {
                    apiURL: "https://api.basescan.org/api",
                    browserURL: "https://basescan.org",
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
            viaIR: true,
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
