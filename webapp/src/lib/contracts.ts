// src/lib/contracts.ts
import type { Abi } from "abitype";
import { erc20Abi } from "abitype/abis";
import { getContract } from "viem";
import { usePublicClient } from "wagmi";
import astaverdeAbi from "../config/AstaVerde.json";
import ecoStabilizerAbi from "../config/EcoStabilizer.json";
import stabilizedCarbonCoinAbi from "../config/StabilizedCarbonCoin.json";

import {
    ASTAVERDE_CONTRACT_ADDRESS,
    USDC_ADDRESS,
    ECOSTABILIZER_CONTRACT_ADDRESS,
    SCC_CONTRACT_ADDRESS,
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

export const ecoStabilizerContractConfig = {
    address: ECOSTABILIZER_CONTRACT_ADDRESS as `0x${string}`,
    abi: ecoStabilizerAbi.abi as Abi,
} as const;

export const sccContractConfig = {
    address: SCC_CONTRACT_ADDRESS as `0x${string}`,
    abi: stabilizedCarbonCoinAbi.abi as Abi,
} as const;

export function getEcoStabilizerContractConfig() {
    if (!ECOSTABILIZER_CONTRACT_ADDRESS) {
        throw new Error("EcoStabilizer contract address not configured");
    }
    return ecoStabilizerContractConfig;
}

export function getSccContractConfig() {
    if (!SCC_CONTRACT_ADDRESS) {
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

    if (!ECOSTABILIZER_CONTRACT_ADDRESS) {
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

    if (!SCC_CONTRACT_ADDRESS) {
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
            console.error("Error checking contract deployment:", error);
            return false;
        }
    };

    return checkDeployment;
}

export function useIsVaultDeployed() {
    const publicClient = usePublicClient();

    const checkVaultDeployment = async () => {
        if (!publicClient || !ECOSTABILIZER_CONTRACT_ADDRESS) {
            return false;
        }
        try {
            const code = await publicClient.getCode({ address: ecoStabilizerContractConfig.address });
            return code !== "0x";
        } catch (error) {
            console.error("Error checking vault deployment:", error);
            return false;
        }
    };

    return checkVaultDeployment;
}

export default astaverdeContractConfig;
