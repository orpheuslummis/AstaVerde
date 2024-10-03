// src/lib/contracts.ts
import type { Abi } from 'abitype';
import { erc20Abi } from "abitype/abis";
import { getContract } from 'viem';
import { usePublicClient } from 'wagmi';
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

export function useAstaVerdeContract() {
  const publicClient = usePublicClient();

  if (!publicClient) {
    throw new Error('Public client not available');
  }

  return getContract({
    address: astaverdeContractConfig.address,
    abi: astaverdeContractConfig.abi,
    client: publicClient,
  });
}

export function useIsContractDeployed() {
  const publicClient = usePublicClient();

  const checkDeployment = async () => {
    if (!publicClient) {
      throw new Error('Public client not available');
    }
    try {
      const code = await publicClient.getCode({ address: astaverdeContractConfig.address });
      return code !== '0x';
    } catch (error) {
      console.error('Error checking contract deployment:', error);
      return false;
    }
  };

  return checkDeployment;
}

export default astaverdeContractConfig;