import type { Abi } from "abitype";
import { erc20Abi } from "abitype/abis";
import astaverdeAbi from "../../config/AstaVerde.json";
import ecoStabilizerAbi from "../../config/EcoStabilizer.json";
import stabilizedCarbonCoinAbi from "../../config/StabilizedCarbonCoin.json";
import { ENV } from "../environment";
import { getActiveMarketplace, VAULT_CONFIGS } from "../../utils/vaultRouting";
import type { ContractConfig } from "../../shared/types/contracts";

// Extended ERC20 ABI with mint function for MockUSDC
const extendedERC20Abi = [
    ...erc20Abi,
    {
        constant: false,
        inputs: [
            { name: "_to", type: "address" },
            { name: "_amount", type: "uint256" },
        ],
        name: "mint",
        outputs: [],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

// Contract configurations
export const contracts = {
    // Phase 1 Contracts
    astaverde: {
        address: ENV.ASTAVERDE_ADDRESS as `0x${string}`,
        abi: astaverdeAbi.abi as Abi,
    } as ContractConfig,

    usdc: {
        address: ENV.USDC_ADDRESS as `0x${string}`,
        abi: ENV.CHAIN_SELECTION === "local" ? extendedERC20Abi : erc20Abi,
    } as ContractConfig,

    // Phase 2 Contracts (optional)
    ecoStabilizer: ENV.ECOSTABILIZER_ADDRESS
        ? ({
              address: ENV.ECOSTABILIZER_ADDRESS as `0x${string}`,
              abi: ecoStabilizerAbi.abi as Abi,
          } as ContractConfig)
        : null,

    scc: ENV.SCC_ADDRESS
        ? ({
              address: ENV.SCC_ADDRESS as `0x${string}`,
              abi: stabilizedCarbonCoinAbi.abi as Abi,
          } as ContractConfig)
        : null,
} as const;

// Helper functions for contract access
export function getAstaVerdeContract(): ContractConfig {
    // Use V1.1 for new purchases if available
    const activeMarketplace = getActiveMarketplace();
    if (activeMarketplace.version === "V1.1" && ENV.ASTAVERDE_V11_ADDRESS) {
        return {
            address: ENV.ASTAVERDE_V11_ADDRESS as `0x${string}`,
            abi: astaverdeAbi.abi as Abi,
        } as ContractConfig;
    }
    return contracts.astaverde;
}

export function getUsdcContract(): ContractConfig {
    return contracts.usdc;
}

export function getEcoStabilizerContract(): ContractConfig {
    if (!contracts.ecoStabilizer) {
        throw new Error("EcoStabilizer contract not configured");
    }
    return contracts.ecoStabilizer;
}

export function getSccContract(): ContractConfig {
    if (!contracts.scc) {
        throw new Error("SCC contract not configured");
    }
    return contracts.scc;
}

// Check if Phase 2 contracts are available
export function isVaultAvailable(): boolean {
    return !!(contracts.ecoStabilizer && contracts.scc);
}

// Export contract addresses for direct access
export const contractAddresses = {
    astaverde: ENV.ASTAVERDE_ADDRESS,
    usdc: ENV.USDC_ADDRESS,
    ecoStabilizer: ENV.ECOSTABILIZER_ADDRESS,
    scc: ENV.SCC_ADDRESS,
} as const;
