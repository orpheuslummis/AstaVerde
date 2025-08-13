# Webapp Code Reorganization Migration Guide

## Overview

The webapp code has been reorganized for better maintainability, scalability, and separation of concerns. This guide helps you migrate from the old structure to the new one.

## New Folder Structure

```
src/
├── features/           # Feature-based modules
│   ├── marketplace/    # Phase 1 marketplace
│   ├── vault/         # Phase 2 vault
│   └── admin/         # Admin functionality
├── shared/            # Shared utilities
├── config/           # All configuration
├── services/         # Business logic layer
└── app/             # Next.js pages
```

## Key Changes

### 1. Import Path Updates

**Old:**

```typescript
import { useContractInteraction } from "../hooks/useContractInteraction";
import { customToast } from "../utils/customToast";
import type { BatchCardProps } from "../types";
```

**New:**

```typescript
import { useMarketplace } from "../features/marketplace";
import { customToast } from "../shared";
import type { BatchCardProps } from "../features/marketplace/types";
```

### 2. Configuration Access

**Old:**

```typescript
import { USDC_DECIMALS, CHAIN_SELECTION } from "../app.config";
import { astaverdeContractConfig } from "../lib/contracts";
```

**New:**

```typescript
import { ENV } from "../config/environment";
import { contracts } from "../config/contracts";
```

### 3. Hook Usage

**Old (monolithic hook):**

```typescript
const { execute, buyBatch, redeemToken } = useContractInteraction(astaverdeContractConfig, "buyBatch");
```

**New (specialized hooks):**

```typescript
// For marketplace operations
const { buyBatch, redeemToken } = useMarketplace();

// For vault operations
const { deposit, withdraw } = useVault();
```

### 4. Service Layer

Business logic is now separated from React hooks:

```typescript
// Services handle contract interactions
import { MarketplaceService } from "../services/blockchain/marketplaceService";
import { VaultService } from "../services/blockchain/vaultService";

// Hooks handle React state and UI concerns
import { useMarketplace } from "../features/marketplace/hooks/useMarketplace";
```

## Migration Steps

### Step 1: Update Imports in Components

Replace old imports with new ones using the barrel exports:

```typescript
// Old
import { useContractInteraction } from "../../hooks/useContractInteraction";
import { BatchCardProps } from "../../types";

// New
import { useMarketplace, BatchCardProps } from "../../features/marketplace";
```

### Step 2: Update Configuration Access

```typescript
// Old
import { USDC_DECIMALS } from "../../app.config";

// New
import { ENV } from "../../config/environment";
const USDC_DECIMALS = ENV.USDC_DECIMALS;
```

### Step 3: Update Hook Usage

Split the monolithic `useContractInteraction` into specialized hooks:

```typescript
// Old
const { execute, readData } = useContractInteraction(contract, "functionName");

// New - for marketplace
const { buyBatch, getCurrentBatchPrice } = useMarketplace();

// New - for vault
const { deposit, withdraw } = useVault();
```

### Step 4: Update Type Imports

Types are now organized by feature:

```typescript
// Old
import type { AppContextType, BatchCardProps, VaultLoan } from "../types";

// New
import type { AppContextType } from "../shared/types/contexts";
import type { BatchCardProps } from "../features/marketplace/types";
import type { VaultLoan } from "../features/vault/types";
```

## Benefits of New Structure

1. **Better Organization** - Code is organized by feature/domain
2. **Improved Maintainability** - Clear separation of concerns
3. **Enhanced Scalability** - Easy to add new features
4. **Better Testing** - Services can be tested independently
5. **Type Safety** - Types are colocated with their features
6. **Phase Separation** - Clear distinction between Phase 1 and Phase 2

## Gradual Migration

The old files are preserved to allow gradual migration:

- Old imports will continue to work
- Migrate components one at a time
- Test each component after migration
- Remove old files once all imports are updated

## Testing After Migration

1. Run the development server: `npm run webapp:dev`
2. Test marketplace functionality (buying, redeeming)
3. Test vault functionality (deposit, withdraw)
4. Test admin panel if applicable
5. Run build to ensure no import errors: `npm run webapp:build`

## Common Issues and Solutions

### Issue: Import not found

**Solution:** Check the barrel exports in feature folders

### Issue: Type errors

**Solution:** Update type imports to use feature-specific types

### Issue: Hook not working

**Solution:** Ensure you're using the correct specialized hook

## Support

If you encounter issues during migration:

1. Check this guide for the correct import paths
2. Refer to the barrel exports (index.ts files) in each feature
3. Ensure all environment variables are set correctly
