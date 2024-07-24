import "@nomicfoundation/hardhat-toolbox";
import { config as dotenvConfig } from "dotenv";
import "hardhat-deploy";
import type { HardhatUserConfig } from "hardhat/config";
import { task } from "hardhat/config";
import type { NetworkUserConfig } from "hardhat/types";
import { resolve } from "path";
import "./tasks/fund-account";

const dotenvConfigPath: string = resolve(__dirname, ".env.local");
dotenvConfig({ path: dotenvConfigPath });

// Ensure that we have all the environment variables we need.
const mnemonic: string | undefined = process.env.MNEMONIC;
if (!mnemonic) {
  throw new Error("Please set your MNEMONIC in a .env file");
}

const alchemyAPIKey: string | undefined = process.env.ALCHEMY_API_KEY;
if (!alchemyAPIKey) {
  throw new Error("Please set your ALCHEMY_API_KEY in a .env file");
}

const chainIds = {
  hardhat: 31337,
  mainnet: 1,
  sepolia: 11155111,
  "optimism-mainnet": 10,
  "base-mainnet": 8453,
  "base-sepolia": 84532,
};

function getChainConfig(chain: keyof typeof chainIds): NetworkUserConfig {
  let jsonRpcUrl: string = process.env.RPC_URL || "";
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
  defaultNetwork: process.env.CHAIN_SELECTION || "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY || "",
    },
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
      mining: {
        auto: true,
        interval: 0,
      },
      accounts: [
        {
          privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
          balance: "1000000000000000000000"
        },
        {
          privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
          balance: "1000000000000000000000"
        },
        {
          privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
          balance: "1000000000000000000000"
        },
        {
          privateKey: "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
          balance: "1000000000000000000000"
        }
      ]
    },
    mainnet: getChainConfig("mainnet"),
    sepolia: getChainConfig("sepolia"),
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

export default config;

task("query-contract", "Queries the AstaVerde contract")
  .setAction(async (taskArgs, hre) => {
    const contractAddress = process.env.CONTRACT_ADDRESS;
    if (!contractAddress) {
      throw new Error("CONTRACT_ADDRESS is not set in .env.local");
    }

    console.log("Contract Address:", contractAddress);

    try {
      const AstaVerde = await hre.ethers.getContractFactory("AstaVerde");
      const contract = AstaVerde.attach(contractAddress);

      // Check contract state
      console.log("\nContract State:");
      try {
        const lastBatchID = await contract.lastBatchID();
        console.log("- Last Batch ID:", lastBatchID.toString());
      } catch (error) {
        console.log("- Error getting lastBatchID:", error.message);
      }

      try {
        const lastTokenID = await contract.lastTokenID();
        console.log("- Last Token ID:", lastTokenID.toString());
      } catch (error) {
        console.log("- Error getting lastTokenID:", error.message);
      }

      // Try to get info for the first batch (if it exists)
      try {
        const batchInfo = await contract.getBatchInfo(1);
        console.log("\nBatch 1 Info:");
        console.log("- Token IDs:", batchInfo.tokenIds.map(id => id.toString()).join(", "));
        console.log("- Creation Time:", new Date(Number(batchInfo.creationTime) * 1000).toLocaleString());
        console.log("- Price:", hre.ethers.formatUnits(batchInfo.price, 6), "USDC");
        console.log("- Remaining Tokens:", batchInfo.remainingTokens.toString());
      } catch (error) {
        console.log("\nError getting batch info:", error.message);
      }

      // Check token balance of the contract for the first token (if it exists)
      try {
        const balance = await contract.balanceOf(contractAddress, 1);
        console.log("\nContract Token Balance (ID 1):", balance.toString());
      } catch (error) {
        console.log("\nError getting token balance:", error.message);
      }

      // Check some constant values
      try {
        const basePrice = await contract.basePrice();
        console.log("\nBase Price:", hre.ethers.formatUnits(basePrice, 6), "USDC");
      } catch (error) {
        console.log("\nError getting base price:", error.message);
      }

      try {
        const priceFloor = await contract.priceFloor();
        console.log("Price Floor:", hre.ethers.formatUnits(priceFloor, 6), "USDC");
      } catch (error) {
        console.log("Error getting price floor:", error.message);
      }

    } catch (error) {
      console.error("Error querying contract:", error);
    }
  });