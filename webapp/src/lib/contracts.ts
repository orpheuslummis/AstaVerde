// src/lib/contracts.ts
import { erc20Abi } from "abitype/abis";
import astaverdeAbi from "../config/AstaVerde.json";

import {
  ASTAVERDE_ADDRESS,
  CHAIN_SELECTION,
  USDC_ADDRESS,
} from "../app.config";

export function getUsdcContractConfig() {
  return CHAIN_SELECTION === "main"
    ? mainUSDCContractConfig
    : mockUSDCContractConfig;
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
  address: ASTAVERDE_ADDRESS as `0x${string}`,
  abi: astaverdeAbi.abi, // Access the `abi` from the default import
} as const;

export default astaverdeContractConfig;
