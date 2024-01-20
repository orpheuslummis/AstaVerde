/**
 * INSTRUCTIONS:
 * 0. Update contracts.mjs with correct addresses and abi
 * 1. Select chain
 * 2. Set events range in block number
 */

import { astaverdeContractConfig, usdcContractConfig } from "../lib/contracts";
import { createPublicClient, http, erc20Abi } from "viem";
import { decodeEventLog } from "viem";
import commander from "commander";

const program = new commander.Command();

program
  .option("--from <blockNumber>", "Specify the starting block number")
  .option("--to <blockNumber>", "Specify the ending block number")
  .option("--chain <chainName>", "Specify the chain name")
  .parse(process.argv);

const { from, to, chain } = program.opts();

if (!from || !to || !chain) {
  console.error("Please provide --from, --to, and --chain arguments.");
  process.exit(1);
}

const fromBlock = BigInt(from);
const toBlock = BigInt(to);

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

    // TBD

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
