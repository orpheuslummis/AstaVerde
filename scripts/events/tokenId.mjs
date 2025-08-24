import { astaverdeContractConfig } from "./contracts.mjs";
import dotenv from "dotenv";
import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

dotenv.config();

/**
 * INSTRUCTIONS:
 * 0. Update contracts.mjs with correct addresses and abi
 * 1. Select chain
 * 2. Set events range in block number
 */
const chain = baseSepolia; // base

export const publicClient = createPublicClient({
    chain,
    transport: http(),
});

const data = await publicClient.readContract({
    abi: astaverdeContractConfig.abi,
    address: astaverdeContractConfig.address,
    functionName: "tokens",
    args: ["1"],
});

console.log(data);
