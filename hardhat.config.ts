import "@nomicfoundation/hardhat-toolbox";
import { ChainConfig } from "@nomicfoundation/hardhat-verify/types";
import { config as dotenvConfig } from "dotenv";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import type { HardhatNetworkUserConfig, NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";

const dotenvConfigPath: string = process.env.DOTENV_CONFIG_PATH || "./.env";
dotenvConfig({ path: resolve(__dirname, dotenvConfigPath) });

// Ensure that we have all the environment variables we need.
const mnemonic: string | undefined = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

const alchemyAPIKey: string | undefined = process.env.ALCHEMY_APIKEY;
if (!alchemyAPIKey) {
  throw new Error("Please set your ALCHEMY_APIKEY in a .env file");
}

// TBD
// function convertToChainConfig(networkConfig: NetworkUserConfig): ChainConfig {
//   return {
//     network: networkConfig.chainId.toString(),
//     chainId: networkConfig.chainId,
//     urls: {
//       apiURL: networkConfig.url,
//       browserURL: networkConfig.url,
//     },
//   };
// }

const chainIds = {
  "arbitrum-mainnet": 42161,
  avalanche: 43114,
  bsc: 56,
  ganache: 1337,
  hardhat: 31337,
  mainnet: 1,
  "optimism-mainnet": 10,
  "polygon-mainnet": 137,
  "polygon-mumbai": 80001,
  sepolia: 11155111,
  "base-mainnet": 8453,
  "base-sepolia": 84532,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string;
  switch (chain) {
    case "avalanche":
      jsonRpcUrl = "https://api.avax.network/ext/bc/C/rpc";
      break;
    case "bsc":
      jsonRpcUrl = "https://bsc-dataseed1.binance.org";
      break;
    case "base-mainnet":
      jsonRpcUrl = "https://mainnet.base.org";
      break;
    case "base-sepolia":
      jsonRpcUrl = "https://sepolia.base.org";
      break;
    default:
      jsonRpcUrl = "https://" + chain + ".g.alchemy.com/v2/" + alchemyAPIKey;
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
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
      optimisticEthereum: process.env.OPTIMISM_API_KEY || "",
      sepolia: process.env.ETHERSCAN_API_KEY || "",
      "base-sepolia": process.env.ETHERSCAN_BASE_SEPOLIA_API_KEY || "",
      "base-mainnet": process.env.ETHERSCAN_BASE_API_KEY || "",
    },
    customChains: [
      // convertToChainConfig(getChainConfig("base-sepolia")),
      {
        network: "base-sepolia",
        chainId: 84532,
        urls: {
          apiURL: "https://sepolia.base.org",
          browserURL: "https://sepolia.base.org",
        },
      },
    ]

  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
    src: "./contracts",
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.hardhat,
    },
    ganache: {
      accounts: {
        mnemonic,
      },
      chainId: chainIds.ganache,
      url: "http://localhost:8545",
    },
    mainnet: getChainConfig("mainnet"),
    optimism: getChainConfig("optimism-mainnet"),
    sepolia: getChainConfig("sepolia"),
    // base
    "base-mainnet": getChainConfig("base-mainnet"),
    "base-sepolia": getChainConfig("base-sepolia"),
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.20",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
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
  sourcify: {
    enabled: false,
  }
};

export default config;
