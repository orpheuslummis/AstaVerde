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
# Development
npm run dev

# Build
npm run build

# Linting
npm run lint
npm run lint:fix

# Testing
npm run test:e2e         # Playwright tests
npm run test:wallet      # Synpress wallet tests
```

## Environment Variables

Required in `webapp/.env.local`:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_CHAIN_ID=84532  # Base Sepolia
NEXT_PUBLIC_INFURA_KEY=your_infura_key
NEXT_PUBLIC_USDC_DECIMALS=6
```

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
