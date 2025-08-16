import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getVaultForAsset, 
  getActiveMarketplace, 
  isV11Asset, 
  isV1Asset,
  getAssetVersion,
  areVaultsConfigured,
  isDualVaultMode,
  VAULT_CONFIGS 
} from '../vaultRouting';
import { ENV } from '../../config/environment';

// Mock the environment module
vi.mock('../../config/environment', () => ({
  ENV: {
    ASTAVERDE_ADDRESS: '0x1234567890123456789012345678901234567890',
    ASTAVERDE_V11_ADDRESS: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    ECOSTABILIZER_ADDRESS: '0x2222222222222222222222222222222222222222',
    ECOSTABILIZER_V11_ADDRESS: '0x3333333333333333333333333333333333333333',
    SCC_ADDRESS: '0x4444444444444444444444444444444444444444',
  }
}));

describe('vaultRouting', () => {
  describe('getVaultForAsset', () => {
    it('should return V1 config for V1 asset address', () => {
      const result = getVaultForAsset(ENV.ASTAVERDE_ADDRESS);
      expect(result).toEqual(VAULT_CONFIGS.V1);
      expect(result?.version).toBe('V1');
    });

    it('should return V1.1 config for V1.1 asset address', () => {
      const result = getVaultForAsset(ENV.ASTAVERDE_V11_ADDRESS);
      expect(result).toEqual(VAULT_CONFIGS.V11);
      expect(result?.version).toBe('V1.1');
    });

    it('should handle case-insensitive addresses', () => {
      const upperCaseAddress = ENV.ASTAVERDE_ADDRESS.toUpperCase();
      const result = getVaultForAsset(upperCaseAddress);
      expect(result).toEqual(VAULT_CONFIGS.V1);
    });

    it('should return null for unknown address', () => {
      const result = getVaultForAsset('0x9999999999999999999999999999999999999999');
      expect(result).toBeNull();
    });

    it('should return null for empty address', () => {
      const result = getVaultForAsset('');
      expect(result).toBeNull();
    });

    it('should return null for zero address', () => {
      const result = getVaultForAsset('0x0');
      expect(result).toBeNull();
    });
  });

  describe('getActiveMarketplace', () => {
    it('should return V1.1 when V1.1 address is configured', () => {
      const result = getActiveMarketplace();
      expect(result).toEqual(VAULT_CONFIGS.V11);
      expect(result.version).toBe('V1.1');
    });

    it('should return V1 when V1.1 address is not configured', () => {
      // Temporarily mock ENV without V1.1 address
      const originalEnv = ENV.ASTAVERDE_V11_ADDRESS;
      Object.defineProperty(ENV, 'ASTAVERDE_V11_ADDRESS', {
        value: '',
        writable: true,
        configurable: true,
      });
      
      const result = getActiveMarketplace();
      expect(result).toEqual(VAULT_CONFIGS.V1);
      
      // Restore original value
      Object.defineProperty(ENV, 'ASTAVERDE_V11_ADDRESS', {
        value: originalEnv,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('isV11Asset', () => {
    it('should return true for V1.1 asset', () => {
      expect(isV11Asset(ENV.ASTAVERDE_V11_ADDRESS)).toBe(true);
    });

    it('should return false for V1 asset', () => {
      expect(isV11Asset(ENV.ASTAVERDE_ADDRESS)).toBe(false);
    });

    it('should handle case-insensitive comparison', () => {
      expect(isV11Asset(ENV.ASTAVERDE_V11_ADDRESS.toUpperCase())).toBe(true);
    });
  });

  describe('isV1Asset', () => {
    it('should return true for V1 asset', () => {
      expect(isV1Asset(ENV.ASTAVERDE_ADDRESS)).toBe(true);
    });

    it('should return false for V1.1 asset', () => {
      expect(isV1Asset(ENV.ASTAVERDE_V11_ADDRESS)).toBe(false);
    });

    it('should handle case-insensitive comparison', () => {
      expect(isV1Asset(ENV.ASTAVERDE_ADDRESS.toLowerCase())).toBe(true);
    });
  });

  describe('getAssetVersion', () => {
    it('should return V1 for V1 asset', () => {
      expect(getAssetVersion(ENV.ASTAVERDE_ADDRESS)).toBe('V1');
    });

    it('should return V1.1 for V1.1 asset', () => {
      expect(getAssetVersion(ENV.ASTAVERDE_V11_ADDRESS)).toBe('V1.1');
    });

    it('should return null for unknown asset', () => {
      expect(getAssetVersion('0x9999999999999999999999999999999999999999')).toBeNull();
    });
  });

  describe('areVaultsConfigured', () => {
    it('should return true when vault addresses are configured', () => {
      expect(areVaultsConfigured()).toBe(true);
    });

    it('should return false when vault addresses are not configured', () => {
      const originalEco = ENV.ECOSTABILIZER_ADDRESS;
      const originalScc = ENV.SCC_ADDRESS;
      
      Object.defineProperty(ENV, 'ECOSTABILIZER_ADDRESS', {
        value: '',
        writable: true,
        configurable: true,
      });
      
      expect(areVaultsConfigured()).toBe(false);
      
      // Restore
      Object.defineProperty(ENV, 'ECOSTABILIZER_ADDRESS', {
        value: originalEco,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('isDualVaultMode', () => {
    it('should return true when both V1.1 addresses are configured', () => {
      expect(isDualVaultMode()).toBe(true);
    });

    it('should return false when V1.1 addresses are not configured', () => {
      const originalV11 = ENV.ASTAVERDE_V11_ADDRESS;
      
      Object.defineProperty(ENV, 'ASTAVERDE_V11_ADDRESS', {
        value: '',
        writable: true,
        configurable: true,
      });
      
      expect(isDualVaultMode()).toBe(false);
      
      // Restore
      Object.defineProperty(ENV, 'ASTAVERDE_V11_ADDRESS', {
        value: originalV11,
        writable: true,
        configurable: true,
      });
    });
  });
});