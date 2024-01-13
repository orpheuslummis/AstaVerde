import { astaverdeContractConfig, usdcContractConfig } from "./contracts.mjs";
import dotenv from "dotenv";
import { createPublicClient, http, erc20Abi } from "viem";
import { decodeEventLog } from "viem";
import { sepolia, mainnet } from "viem/chains";

dotenv.config();

if (!process.env.INFURA_API_KEY) throw new Error("INFURA_API_KEY not found");
const INFURA_API_KEY = process.env.INFURA_API_KEY;

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

// Fetch event logs for every event on every ERC-20 contract.
const logs = await publicClient.getContractEvents({
  address: astaverdeContractConfig.address,
  abi: astaverdeContractConfig.abi,
  fromBlock: BigInt("5046895"),
  toBlock: BigInt("5047299"),
});

if (logs.length > 0) {
  const topics = decodeEventLog({
    abi: astaverdeContractConfig.abi,
    data: logs[0].data,
    topics: logs[0].topics,
  });

  console.log(topics);
  // console.log(topics);
} else {
  console.log("No logs");
}
