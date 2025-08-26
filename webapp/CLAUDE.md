# CLAUDE.md - Webapp Development Guide

This file provides guidance to Claude Code when working with the AstaVerde webapp.

## Overview

The webapp is a Next.js 14 application using TypeScript, Tailwind CSS, and Web3 integration via wagmi/viem. It serves as the frontend for the AstaVerde carbon offset NFT marketplace with producer dashboard and admin controls.

## Linting and Formatting

```bash
# Check for issues
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# TypeScript check
npx tsc --noEmit
```

## Project Structure

```
webapp/
├── src/
│   ├── app/                    # Next.js 14 app directory
│   │   ├── layout.tsx          # Root layout
│   │   ├── page.tsx            # Home/marketplace page
│   │   ├── producer/           # Producer dashboard (NEW)
│   │   ├── mytokens/           # User's tokens and vault
│   │   ├── admin/              # Admin panel with new controls
│   │   └── mint/               # Minting interface
│   ├── components/             # Shared components
│   │   ├── Header.tsx          # Navigation with producer link
│   │   └── [others]
│   ├── hooks/                  # Custom React hooks
│   │   ├── useIsProducer.ts    # Producer detection (NEW)
│   │   └── useContractInteraction.ts
│   ├── contexts/               # React contexts
│   │   └── AppContext.tsx      # Updated with new admin functions
│   └── config/                 # Configuration files
```

## Development Commands

```bash
# Development (from webapp/ directory)
npm run dev              # Start webapp (connects to .env.local config)
npm run dev:turbo        # Start with Turbo mode

# Build
npm run build            # Production build

# Linting
npm run lint             # Check for issues
npm run lint:fix         # Auto-fix issues

# From root directory - Full environments:
npm run dev:local        # Local stack (port 3000/3001)
npm run dev:sepolia      # Sepolia stack (port 3002)
npm run dev:both         # Both simultaneously
```

## Environment Variables

### Local Development (`webapp/.env.local`)
Generated automatically by `npm run dev:local`. Contains:
- Local contract addresses (deployed to Hardhat node)
- Chain selection: `local`
- Demo API keys

### Sepolia Testing (`webapp/.env.sepolia`)
Configure manually after deploying contracts:
```
NEXT_PUBLIC_CHAIN_SELECTION=base_sepolia
NEXT_PUBLIC_ASTAVERDE_ADDRESS=0x...      # From deployment
NEXT_PUBLIC_ECOSTABILIZER_ADDRESS=0x...  # From deployment
NEXT_PUBLIC_SCC_ADDRESS=0x...            # From deployment
NEXT_PUBLIC_USDC_ADDRESS=0x...           # From deployment
NEXT_PUBLIC_ALCHEMY_API_KEY=your_key
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_id
```

Each environment uses its own config file - no switching needed.

## Contract Integration

### Updated Features

- `claimProducerFunds()` - Producer payment claims
- `getProducerBalance()` - Check claimable balance
- `setMaxPriceUpdateIterations()` - Gas optimization control
- `recoverSurplusUSDC()` - Emergency recovery
- `producerBalances` mapping - Track accrued payments

### Key Patterns

```typescript
// Producer detection
import { useIsProducer } from "@/hooks/useIsProducer";

// Contract interaction
import { useContractInteraction } from "@/hooks/useContractInteraction";

// Toast notifications
import { customToast } from "@/utils/customToast";
```

## Before Committing

1. Run build: `npm run build`
2. Fix linting: `npm run lint:fix`
3. Remove console.log statements
4. Test TypeScript: `npx tsc --noEmit`
5. Verify no hardcoded values
