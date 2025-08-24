// src/lib/contracts.ts
import type { Abi } from "abitype";
import { erc20Abi } from "abitype/abis";
import { getContract } from "viem";
import { usePublicClient } from "wagmi";
import astaverdeAbi from "../config/AstaVerde.json";
import ecoStabilizerAbi from "../config/EcoStabilizer.json";
import stabilizedCarbonCoinAbi from "../config/StabilizedCarbonCoin.json";
import mockUsdcAbi from "../config/MockUSDC.json";

import { ENV } from "../config/environment";
import { getVaultForAsset, VAULT_CONFIGS } from "../utils/vaultRouting";

export function getUsdcContractConfig() {
  // For local development, always use MockUSDC ABI
  // Check if we're on local chain or if the address matches common MockUSDC patterns
  const isLocalChain = ENV.CHAIN_SELECTION === "local";
  const isMockContract = isLocalChain || ENV.USDC_ADDRESS.toLowerCase().startsWith("0x5fbd");
  return {
    address: ENV.USDC_ADDRESS as `0x${string}`,
    abi: isMockContract ? (mockUsdcAbi.abi as Abi) : extendedERC20Abi,
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
  address: ENV.USDC_ADDRESS as `0x${string}`,
  abi: erc20Abi,
} as const;

// MockUSDC on Base Sepolia
export const mockUSDCContractConfig = {
  address: ENV.USDC_ADDRESS as `0x${string}`,
  abi: extendedERC20Abi,
} as const;

// V1 Contracts
export const astaverdeContractConfig = {
  address: ENV.ASTAVERDE_ADDRESS as `0x${string}`,
  abi: astaverdeAbi.abi as Abi,
} as const;

export const ecoStabilizerContractConfig = {
  address: ENV.ECOSTABILIZER_ADDRESS as `0x${string}`,
  abi: ecoStabilizerAbi.abi as Abi,
} as const;

// V1.1 Contracts
export const astaverdeV11ContractConfig = {
  address: (ENV.ASTAVERDE_V11_ADDRESS || ENV.ASTAVERDE_ADDRESS) as `0x${string}`,
  abi: astaverdeAbi.abi as Abi,
} as const;

export const ecoStabilizerV11ContractConfig = {
  address: (ENV.ECOSTABILIZER_V11_ADDRESS || ENV.ECOSTABILIZER_ADDRESS) as `0x${string}`,
  abi: ecoStabilizerAbi.abi as Abi,
} as const;


export const sccContractConfig = {
  address: ENV.SCC_ADDRESS as `0x${string}`,
  abi: stabilizedCarbonCoinAbi.abi as Abi,
} as const;

// All EcoStabilizer contracts now have batch functions built-in
export async function detectVaultVersion(publicClient: unknown): Promise<"V1" | "V2"> {
  // Since we merged V2 into base contract, all deployments now support batch operations
  return "V2";
}

export function getEcoStabilizerContractConfig() {
  if (!ENV.ECOSTABILIZER_ADDRESS) {
    throw new Error("EcoStabilizer contract address not configured");
  }
  // Single contract now includes batch operations
  return ecoStabilizerContractConfig;
}

// Get the appropriate AstaVerde contract config based on the asset address
export function getAstaVerdeConfigForAsset(assetAddress: string) {
  const vault = getVaultForAsset(assetAddress);
  if (!vault) {
    // Default to V1 if asset not recognized
    return astaverdeContractConfig;
  }
  // Return the appropriate config based on the asset address
  return vault.astaVerdeAddress === ENV.ASTAVERDE_V11_ADDRESS ? astaverdeV11ContractConfig : astaverdeContractConfig;
}

// Get the appropriate EcoStabilizer contract config based on the asset address
export function getEcoStabilizerConfigForAsset(assetAddress: string) {
  const vault = getVaultForAsset(assetAddress);
  if (!vault) {
    // Default to V1 if asset not recognized
    return ecoStabilizerContractConfig;
  }
  // Return the appropriate config based on the vault address
  return vault.ecoStabilizerAddress === ENV.ECOSTABILIZER_V11_ADDRESS ? ecoStabilizerV11ContractConfig : ecoStabilizerContractConfig;
}

export function getSccContractConfig() {
  if (!ENV.SCC_ADDRESS) {
    throw new Error("SCC contract address not configured");
  }
  return sccContractConfig;
}

export function useAstaVerdeContract() {
  const publicClient = usePublicClient();

  if (!publicClient) {
    throw new Error("Public client not available");
  }

  return getContract({
    address: astaverdeContractConfig.address,
    abi: astaverdeContractConfig.abi,
    client: publicClient,
  });
}

export function useEcoStabilizerContract() {
  const publicClient = usePublicClient();

  if (!publicClient) {
    throw new Error("Public client not available");
  }

  if (!ENV.ECOSTABILIZER_ADDRESS) {
    throw new Error("EcoStabilizer contract address not configured");
  }

  return getContract({
    address: ecoStabilizerContractConfig.address,
    abi: ecoStabilizerContractConfig.abi,
    client: publicClient,
  });
}

export function useSccContract() {
  const publicClient = usePublicClient();

  if (!publicClient) {
    throw new Error("Public client not available");
  }

  if (!ENV.SCC_ADDRESS) {
    throw new Error("SCC contract address not configured");
  }

  return getContract({
    address: sccContractConfig.address,
    abi: sccContractConfig.abi,
    client: publicClient,
  });
}

export function useIsContractDeployed() {
  const publicClient = usePublicClient();

  const checkDeployment = async () => {
    if (!publicClient) {
      throw new Error("Public client not available");
    }
    try {
      const code = await publicClient.getCode({ address: astaverdeContractConfig.address });
      return code !== "0x";
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error checking contract deployment:", error);
      return false;
    }
  };

  return checkDeployment;
}

export function useIsVaultDeployed() {
  const publicClient = usePublicClient();

  const checkVaultDeployment = async () => {
    if (!publicClient || !ENV.ECOSTABILIZER_ADDRESS) {
      return false;
    }
    try {
      const code = await publicClient.getCode({ address: ecoStabilizerContractConfig.address });
      return code !== "0x";
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error checking vault deployment:", error);
      return false;
    }
  };

  return checkVaultDeployment;
}

export default astaverdeContractConfig;
