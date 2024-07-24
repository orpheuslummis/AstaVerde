// src/lib/contracts.ts
import { getPublicClient } from '@wagmi/core';
import { Abi } from 'abitype';
import { erc20Abi } from "abitype/abis";
import { getContract } from 'viem';
import astaverdeAbi from "../config/AstaVerde.json";

import {
  ASTAVERDE_CONTRACT_ADDRESS,
  USDC_ADDRESS
} from "../app.config";

export function getUsdcContractConfig() {
  return {
    address: USDC_ADDRESS as `0x${string}`,
    abi: extendedERC20Abi,
  };
}

const extendedERC20Abi = [
  ...erc20Abi,
  {
    constant: false,
    inputs: [
      {
        name: "_to",
        type: "address",
      },
      {
        name: "_amount",
        type: "uint256",
      },
    ],
    name: "mint",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
];

// Base Sepolia official USDC
export const mainUSDCContractConfig = {
  address: USDC_ADDRESS as `0x${string}`,
  abi: erc20Abi,
} as const;

// MockUSDC on Base Sepolia
export const mockUSDCContractConfig = {
  address: USDC_ADDRESS as `0x${string}`,
  abi: extendedERC20Abi,
} as const;

export const astaverdeContractConfig = {
  address: ASTAVERDE_CONTRACT_ADDRESS as `0x${string}`,
  abi: astaverdeAbi.abi as Abi,
} as const;

export function getAstaVerdeContract() {
  try {
    const publicClient = getPublicClient()
    return getContract({
      ...astaverdeContractConfig,
      publicClient,
    });
  } catch (error) {
    console.error('Failed to get AstaVerde contract:', error);
    throw new Error('AstaVerde contract initialization failed');
  }
}

export async function isContractDeployed() {
  try {
    const code = await publicClient.getCode({ address: astaverdeContractConfig.address });
    return code !== '0x';
  } catch (error) {
    console.error('Error checking contract deployment:', error);
    return false;
  }
}

console.log("AstaVerde Contract Config:", astaverdeContractConfig);

export default astaverdeContractConfig;