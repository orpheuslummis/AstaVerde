import { erc20Abi } from "abitype/abis";
import ASTAVERDE_ABI from "../../../artifacts/contracts/AstaVerde.sol/AstaVerde.json";

const CHAIN_SELECTION = process.env.NEXT_PUBLIC_CHAIN_SELECTION ||
  process.env.CHAIN_SELECTION || "local";

const USDC_ADDRESS =
  process.env[`USDC_ADDRESS_${CHAIN_SELECTION.toUpperCase()}`];

const ASTAVERDE_ADDRESS =
  process.env[`ASTAVERDE_ADDRESS_${CHAIN_SELECTION.toUpperCase()}`];

export function getUsdcContractConfig() {
  if (CHAIN_SELECTION === "main") {
    return mainUSDCContractConfig;
  }
  return mockUSDCContractConfig;
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
};

// MockUSDC on Base Sepolia
export const mockUSDCContractConfig = {
  address: USDC_ADDRESS as `0x${string}`,
  abi: extendedERC20Abi,
} as const;

export const astaverdeContractConfig = {
  address: ASTAVERDE_ADDRESS as `0x${string}`,
  abi: ASTAVERDE_ABI.abi,
} as const;
