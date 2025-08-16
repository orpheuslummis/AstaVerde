# CLAUDE.md - Webapp Development Guide

This file provides guidance to Claude Code when working with the AstaVerde webapp.

## Overview

The webapp is a Next.js 14 application using TypeScript, Tailwind CSS, and Web3 integration via wagmi/viem. It serves as the frontend for the AstaVerde carbon offset NFT marketplace and EcoStabilizer vault system.

## Linting and Formatting

**IMPORTANT:** This project uses **Biome** for linting and formatting, NOT ESLint.

```bash
# Check for issues
npx @biomejs/biome check webapp/src

# Fix auto-fixable issues
npx @biomejs/biome check webapp/src --write

# Format code
npx @biomejs/biome format webapp/src --write
```

Current Biome configuration:
- Indent: 2 spaces
- Line width: 120 characters
- Formatter and linter enabled
- Organize imports enabled

## Known Issues to Fix

### TypeScript Compilation Errors (37 total)
1. **Missing USDC_DECIMALS constant** - Referenced but not imported in multiple files
   - Fix: Import from `config/constants.ts` or define locally
2. **Viem/ox type compatibility** - Known issue with viem 2.33.3
   - Note: Configured in next.config.js to handle this
3. **Missing vault types** - `../../features/vault/types` doesn't exist
   - Fix: Create the types file or update import path

### Code Quality Issues
1. **Duplicate `useBatchOperations` hook**
   - Location 1: `src/hooks/useContractInteraction.ts` (original, 230+ lines)
   - Location 2: `src/features/marketplace/hooks/useBatchOperations.ts` (new, ~50 lines)
   - Action: Choose one implementation and remove the other

2. **Duplicate utilities**
   - `src/@/lib/utils.ts` and `src/lib/utils.ts` contain identical `cn()` function
   - Action: Keep one, remove the other

3. **Console statements (111+)**
   - Development artifacts that should be removed or replaced with proper logging
   - Consider using a logging service or conditional logging

4. **Large component files**
   - `src/app/mytokens/page.tsx` (832 lines)
   - `src/app/admin/page.tsx` (583 lines)
   - Action: Break into smaller components

## Project Structure

```
webapp/
├── src/
│   ├── app/                    # Next.js 14 app directory
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home/marketplace page
│   │   ├── mytokens/           # User's tokens and vault
│   │   ├── admin/              # Admin panel
│   │   ├── mint/               # Minting interface
│   │   └── [other pages]/
│   ├── components/             # Shared components
│   │   ├── BatchCard.tsx       # Batch display component
│   │   ├── VaultCard.tsx       # Vault interface
│   │   ├── Header.tsx          # Navigation
│   │   └── Providers.tsx       # Context providers
│   ├── hooks/                  # Custom React hooks
│   │   ├── useContractInteraction.ts
│   │   └── useVault.ts
│   ├── contexts/               # React contexts
│   │   ├── AppContext.tsx      # Global app state
│   │   └── WalletContext.tsx   # Wallet connection state
│   ├── services/               # Business logic
│   │   └── blockchain/         # Contract interactions
│   ├── config/                 # Configuration files
│   │   ├── chains.ts           # Chain configurations
│   │   ├── wagmi.ts            # Wagmi config
│   │   └── *.json              # Contract ABIs
│   ├── utils/                  # Utility functions
│   └── features/               # Feature-based organization (new)
│       └── marketplace/
```

## Development Patterns

### Contract Interaction Pattern
```typescript
// Use the existing hooks for contract interactions
import { useContractInteraction } from '@/hooks/useContractInteraction';

// For vault operations
import { useVault } from '@/hooks/useVault';
```

### Error Handling
```typescript
// Use the centralized error handling
import { parseVaultError } from '@/utils/errors';
import { customToast } from '@/utils/customToast';

// Consistent error handling pattern
try {
  // operation
} catch (error) {
  const vaultError = parseVaultError(error);
  customToast.error(vaultError.message);
}
```

### IPFS Integration
```typescript
// Use existing IPFS helpers
import { fetchJsonFromIpfsWithFallback, resolveIpfsUriToUrl } from '@/utils/ipfsHelper';
```

## Testing

### E2E Tests
```bash
# Playwright tests
npm run test:e2e

# Wallet integration tests (Synpress)
npm run test:wallet
```

### Local Development
```bash
# Start development server
npm run dev

# Build for production
npm run build
```

## Environment Variables

Required in `webapp/.env.local`:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_CHAIN_ID=84532  # Base Sepolia
NEXT_PUBLIC_INFURA_KEY=your_infura_key
```

## Common Tasks

### Adding a New Page
1. Create file in `src/app/[page-name]/page.tsx`
2. Use the `"use client"` directive for client components
3. Import necessary hooks and contexts
4. Follow existing patterns for wallet connection checks

### Adding Contract Interaction
1. Check if functionality exists in `useContractInteraction` or `useVault`
2. If new, add to appropriate service in `services/blockchain/`
3. Use wagmi hooks: `useReadContract`, `useWriteContract`, `useWaitForTransactionReceipt`
4. Handle errors consistently with `parseVaultError`

### Working with Toast Notifications
```typescript
import { customToast } from '@/utils/customToast';

// Consistent usage
customToast.success("Operation successful");
customToast.error("Operation failed");
customToast.loading("Processing...");
```

## Performance Considerations

1. **Large Components**: Break down files >300 lines into smaller components
2. **React Query**: Use for data fetching and caching
3. **Image Optimization**: Use Next.js Image component for images
4. **Bundle Size**: Remove unused dependencies (see unused deps list)

## Unused Dependencies to Remove

```bash
# Dependencies that can be removed
- class-variance-authority
- encoding  
- lucide-react
- pino-pretty
- react-error-boundary
```

## Code Style Guidelines

1. **TypeScript**: Avoid `any` types, use proper typing
2. **Components**: Functional components with hooks (no class components)
3. **Imports**: Let Biome organize imports automatically
4. **Naming**: 
   - Components: PascalCase
   - Hooks: camelCase starting with 'use'
   - Utils: camelCase
   - Constants: UPPER_SNAKE_CASE

## Important Files

- `app.config.ts` - Central configuration for contract addresses and chain selection
- `config/constants.ts` - Application constants (needs USDC_DECIMALS)
- `contexts/AppContext.tsx` - Global state management
- `hooks/useContractInteraction.ts` - Main contract interaction logic

## Phase 2 Vault Integration Status

- Smart contracts: ✅ Complete
- Contract ABIs: ✅ Generated
- Vault hooks: ✅ Implemented (`useVault.ts`)
- UI Components: ⚠️ `VaultCard.tsx` needs testing
- Vault pages: ⚠️ Need production UI implementation

## Before Committing

1. Run Biome check: `npx @biomejs/biome check webapp/src`
2. Fix TypeScript errors: `npx tsc --noEmit`
3. Test build: `npm run build`
4. Remove console.log statements
5. Ensure no hardcoded test values

## Memory Patterns

When fixing recurring issues, create memory files:
- `.claude/memory/webapp-usdc-decimals-fix.md`
- `.claude/memory/webapp-toast-pattern.md`
- `.claude/memory/webapp-error-handling.md`