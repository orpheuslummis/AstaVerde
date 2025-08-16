// Minimal vault routing utility for dual-vault setup
// Maps an AstaVerde marketplace address (asset) to its bound EcoStabilizer vault

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