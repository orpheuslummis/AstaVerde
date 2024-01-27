import { astaverdeContractConfig, usdcContractConfig } from "./contracts.mjs";
import dotenv from "dotenv";
import { createPublicClient, http, erc20Abi } from "viem";
import { decodeEventLog } from "viem";
import { sepolia, mainnet, base, baseSepolia } from "viem/chains";

dotenv.config();

/**
 * INSTRUCTIONS:
 * 0. Update contracts.mjs with correct addresses and abi
 * 1. Select chain
 * 2. Set events range in block number
 */
const chain = baseSepolia; // base
const fromBlock = BigInt("5282940"); // get from etherscan.io > events > Block
const toBlock = BigInt("5282950");

export const publicClient = createPublicClient({
  chain,
  transport: http(),
});

const logs = await publicClient.getContractEvents({
  address: astaverdeContractConfig.address,
  abi: astaverdeContractConfig.abi,
  eventName: "TokenReedemed",
  fromBlock,
  toBlock,
});

if (logs.length > 0) {
  for (const log of logs) {
    const topics = decodeEventLog({
      abi: astaverdeContractConfig.abi,
      data: log.data,
      topics: log.topics,
    });

    // Extract values from topics
    const { eventName, args } = topics;
    const { tokenId, redeemer, timestamp } = args;

    // Format tokenId as a regular number
    const formattedTokenId = Number(tokenId);

    // Convert timestamp to a human-readable date
    const formattedTimestamp = new Date(Number(timestamp) * 1000);

    // Log human-friendly output
    console.log(`Event: ${eventName}`);
    console.log(`tokenId: ${formattedTokenId}`);
    console.log(`redeemer: ${redeemer}`);
    console.log(`timestamp: ${formattedTimestamp}`);
    console.log("-------------------------");
  }
} else {
  console.log("No logs");
}
