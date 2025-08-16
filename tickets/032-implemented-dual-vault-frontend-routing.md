# Ticket 032: Dual-Vault Frontend Routing Implementation

**Status:** ✅ COMPLETED  
**Priority:** HIGH  
**Type:** FEATURE  
**Component:** Webapp  
**Related:** SSC_PLAN.md Option B implementation

## Summary

Implemented complete frontend routing infrastructure to support dual-vault architecture (Option B) where V1 and V1.1 AstaVerde contracts each have their own vault, sharing a common SCC token. This allows safe coexistence of legacy V1 NFTs alongside hardened V1.1 NFTs.

## Problem Statement

Per SSC_PLAN.md, the V1 AstaVerde contract has critical vulnerabilities that cannot be fixed post-deployment:
- Refund siphoning attack allowing theft of platform funds
- Redeemed token resale blocking legitimate purchases
- Price update DoS via batch creation spam

Option B (dual vault) was chosen as the production strategy, requiring frontend routing to:
1. Direct new purchases to V1.1 
2. Route vault operations to the correct vault based on asset origin
3. Provide clear UI indicators of asset versions

## Implementation Details

### 1. Environment Configuration
**Files Modified:**
- `webapp/.env.local`
- `webapp/src/config/environment.ts`

**Changes:**
```typescript
// Added to ENV configuration
ASTAVERDE_V11_ADDRESS: process.env.NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS || "",
ECOSTABILIZER_V11_ADDRESS: process.env.NEXT_PUBLIC_ECOSTABILIZER_V11_ADDRESS || "",
```

### 2. Vault Routing Utility
**File Created:** `webapp/src/utils/vaultRouting.ts`

**Key Functions:**
- `getVaultForAsset(assetAddress)` - Maps asset to its vault configuration
- `getActiveMarketplace()` - Returns V1.1 config for new purchases
- `getAssetVersion(assetAddress)` - Returns "V1" or "V1.1"
- `isDualVaultMode()` - Checks if dual vault is configured

### 3. Contract Configuration Updates
**Files Modified:**
- `webapp/src/lib/contracts.ts`
- `webapp/src/config/contracts/index.ts`

**Changes:**
- Added V1.1 contract configurations
- Created asset-aware config getters: `getAstaVerdeConfigForAsset()`, `getEcoStabilizerConfigForAsset()`
- Modified `getAstaVerdeContract()` to default to V1.1 for new purchases

### 4. Hook Updates
**File Modified:** `webapp/src/hooks/useVault.ts`

**Changes:**
- Added optional `assetAddress` parameter to `useVault(assetAddress?: string)`
- Vault operations now route to correct contract based on asset
- Proper vault address used for approvals and loan queries

### 5. UI Component Updates
**Files Modified:**
- `webapp/src/components/VaultCard.tsx`
- `webapp/src/components/BatchCard.tsx`

**Visual Indicators:**
- Blue badges for V1.1 assets: `bg-blue-100 text-blue-800`
- Gray badges for V1 assets: `bg-gray-100 text-gray-800`
- Version displayed in both compact and full card modes

### 6. Smart Contract Enhancement
**File Modified:** `contracts/AstaVerde.sol`

**Changes:**
```solidity
// Added event
event TrustedVaultSet(address indexed previousVault, address indexed newVault);

// Modified setTrustedVault to emit event
function setTrustedVault(address _vault) external onlyOwner {
    require(_vault != address(0), "Invalid vault address");
    address previousVault = trustedVault;
    trustedVault = _vault;
    emit TrustedVaultSet(previousVault, _vault);
}
```

### 7. Test Coverage
**File Created:** `webapp/src/utils/__tests__/vaultRouting.test.ts`

**Test Coverage:**
- Asset to vault mapping
- Version detection
- Configuration validation
- Edge cases (empty/zero addresses)
- Case-insensitive address handling

## Technical Architecture

```
User Action
    │
    ├─> New Purchase
    │   └─> getActiveMarketplace() → V1.1
    │
    └─> Vault Operation
        └─> getVaultForAsset(tokenAddress)
            ├─> V1 Asset → V1 Vault
            └─> V1.1 Asset → V1.1 Vault
```

## Benefits

1. **Security**: V1 vulnerabilities contained, new purchases use hardened V1.1
2. **Compatibility**: Existing V1 NFTs continue working with their vault
3. **Transparency**: Clear UI indicators show asset versions
4. **Simplicity**: Shared SCC token avoids liquidity fragmentation
5. **Future-Proof**: Easy to deprecate V1 once migration complete

## Testing Instructions

1. **Local Development:**
```bash
# Set V1.1 addresses in .env.local (currently same as V1 for local)
NEXT_PUBLIC_ASTAVERDE_V11_ADDRESS=0x...
NEXT_PUBLIC_ECOSTABILIZER_V11_ADDRESS=0x...
```

2. **Verify Routing:**
- New purchases should show "V1.1" badge
- V1 NFTs should use V1 vault
- V1.1 NFTs should use V1.1 vault

3. **Run Tests:**
```bash
cd webapp
npm test -- vaultRouting.test.ts
```

## Deployment Checklist

- [ ] Deploy V1.1 AstaVerde contract
- [ ] Deploy V1.1 EcoStabilizer vault
- [ ] Grant MINTER_ROLE to both vaults on SCC
- [ ] Set V1.1 addresses in production environment
- [ ] Call `setTrustedVault` on V1 AstaVerde (for pause bypass)
- [ ] Verify routing in staging environment
- [ ] Monitor first V1.1 purchases

## Related Documentation

- `SSC_PLAN.md` - Stabilized Carbon Coin implementation plan
- `ssc_changes.md` - Security analysis and Option B rationale
- Ticket #031 - Coexistence plan for V1/V1.1

## Code Quality Metrics

- **Files Modified:** 10
- **Files Created:** 2  
- **Test Coverage:** Comprehensive unit tests
- **Type Safety:** Full TypeScript typing maintained
- **Breaking Changes:** None - backward compatible

## Notes

- Environment variables default to V1 if V1.1 not configured
- Vault routing is transparent to users
- No migration required for existing V1 NFTs
- Frontend automatically handles version detection

## Completion Date

January 16, 2025

---

*This implementation enables safe dual-vault operation per Option B strategy, protecting new users while maintaining compatibility with existing V1 assets.*