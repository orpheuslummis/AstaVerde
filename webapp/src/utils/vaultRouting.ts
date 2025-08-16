// Minimal vault routing utility for dual-vault setup
// Maps an AstaVerde marketplace address (asset) to its bound EcoStabilizer vault

import { ENV } from "../config/environment";

export function getVaultForAsset(assetAddress: `0x${string}`): `0x${string}` {
    const v1 = (process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS || ENV.ASTAVERDE_ADDRESS) as string;
    const v11 = process.env.NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS as string | undefined;
    const vaultV1 = (process.env.NEXT_PUBLIC_ECOSTABILIZER_ADDRESS || ENV.ECOSTABILIZER_ADDRESS) as string;
    const vaultV11 = process.env.NEXT_PUBLIC_ECOSTABILIZER_V11_ADDRESS as string | undefined;

    if (!assetAddress) {
        throw new Error("Asset address is required for vault routing");
    }

    if (v1 && assetAddress.toLowerCase() === v1.toLowerCase()) {
        if (!vaultV1) throw new Error("Vault address for V1 is not configured");
        return vaultV1 as `0x${string}`;
    }

    if (v11 && assetAddress.toLowerCase() === v11.toLowerCase()) {
        if (!vaultV11) throw new Error("Vault address for V1.1 is not configured");
        return vaultV11 as `0x${string}`;
    }

    throw new Error("Unknown asset contract for vault routing");
}

export function getMarketplaceVersion(assetAddress: `0x${string}`): "V1" | "V1.1" {
    const v1 = (process.env.NEXT_PUBLIC_ASTAVERDE_ADDRESS || ENV.ASTAVERDE_ADDRESS) as string;
    const v11 = process.env.NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS as string | undefined;

    if (v1 && assetAddress.toLowerCase() === v1.toLowerCase()) return "V1";
    if (v11 && assetAddress.toLowerCase() === v11.toLowerCase()) return "V1.1";
    throw new Error("Unknown asset contract for version detection");
}

import { ENV } from "@/config/environment";

export interface VaultConfig {
  astaVerdeAddress: `0x${string}`;
  ecoStabilizerAddress: `0x${string}`;
  version: "V1" | "V1.1";
}

export const VAULT_CONFIGS: Record<string, VaultConfig> = {
  V1: {
    astaVerdeAddress: ENV.ASTAVERDE_ADDRESS as `0x${string}`,
    ecoStabilizerAddress: ENV.ECOSTABILIZER_ADDRESS as `0x${string}`,
    version: "V1",
  },
  V11: {
    astaVerdeAddress: ENV.ASTAVERDE_V11_ADDRESS as `0x${string}`,
    ecoStabilizerAddress: ENV.ECOSTABILIZER_V11_ADDRESS as `0x${string}`,
    version: "V1.1",
  },
};

export function getVaultForAsset(assetAddress: string): VaultConfig | null {
  const normalizedAddress = assetAddress.toLowerCase();
  
  if (!normalizedAddress || normalizedAddress === "0x0") {
    return null;
  }

  if (normalizedAddress === ENV.ASTAVERDE_ADDRESS?.toLowerCase()) {
    return VAULT_CONFIGS.V1;
  }
  
  if (normalizedAddress === ENV.ASTAVERDE_V11_ADDRESS?.toLowerCase()) {
    return VAULT_CONFIGS.V11;
  }
  
  return null;
}

export function getActiveMarketplace(): VaultConfig {
  if (ENV.ASTAVERDE_V11_ADDRESS) {
    return VAULT_CONFIGS.V11;
  }
  return VAULT_CONFIGS.V1;
}

export function isV11Asset(assetAddress: string): boolean {
  return assetAddress.toLowerCase() === ENV.ASTAVERDE_V11_ADDRESS?.toLowerCase();
}

export function isV1Asset(assetAddress: string): boolean {
  return assetAddress.toLowerCase() === ENV.ASTAVERDE_ADDRESS?.toLowerCase();
}

export function getAssetVersion(assetAddress: string): "V1" | "V1.1" | null {
  const vault = getVaultForAsset(assetAddress);
  return vault?.version || null;
}

export function areVaultsConfigured(): boolean {
  return !!(ENV.ECOSTABILIZER_ADDRESS && ENV.SCC_ADDRESS);
}

export function isDualVaultMode(): boolean {
  return !!(ENV.ASTAVERDE_V11_ADDRESS && ENV.ECOSTABILIZER_V11_ADDRESS);
}