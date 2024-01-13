import { astaverdeContractConfig, usdcContractConfig } from "./contracts.mjs";
import dotenv from "dotenv";
import { createPublicClient, http, erc20Abi } from "viem";
import { decodeEventLog } from "viem";
import { sepolia, mainnet, base } from "viem/chains";

dotenv.config();

/**
 * INSTRUCTIONS:
 * 1. Select chain
 * 2. Set events range in block number
 */
const chain = sepolia; // base
const fromBlock = BigInt("5046895"); // get from etherscan.io > events > Block
const toBlock = BigInt("5047299");

export const publicClient = createPublicClient({
  chain,
  transport: http(),
});

// Fetch event logs for every event on every ERC-20 contract.
const logs = await publicClient.getContractEvents({
  address: astaverdeContractConfig.address,
  abi: astaverdeContractConfig.abi,
  eventName: "TokenReedemed",
  fromBlock,
  toBlock,
});

if (logs.length > 0) {
  logs.forEach((log) => {
    const topics = decodeEventLog({
      abi: astaverdeContractConfig.abi,
      data: log.data,
      topics: log.topics,
    });

    console.log(topics);
    // Perform other operations with 'topics' as needed
  });
} else {
  console.log("No logs");
}
