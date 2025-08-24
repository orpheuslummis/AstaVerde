# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Building and Compilation

- `npm run compile` - Compiles smart contracts and generates webapp config files
- `npm run typechain` - Generates TypeScript bindings for contracts
- `npm run clean` - Cleans artifacts, cache, and regenerates typechain

### Testing

- `npm run test` - Runs all contract tests using Hardhat
- `npm run coverage` - Runs test coverage analysis

### Quick QA (Optimized for Claude Code)

- `npm run qa:status` - Ultra-fast system health check (~400ms)
- `npm run qa:fast` - Fast critical path testing (~450ms)
- `npm run qa:full` - Comprehensive testing with detailed reports

### Manual QA Environment (Complete Local Dev)

- `npm run dev:complete` - **One command: All testing scenarios combined**
- `npm run start` - Alias for dev:complete

### Linting and Formatting

- `npm run lint` - Runs all linting (Solidity + TypeScript + Prettier)
- `npm run lint:sol` - Lints Solidity contracts only
- `npm run prettier:check` - Checks code formatting
- `npm run prettier:write` - Fixes code formatting

### Deployment

- `npm run deploy:testnet` - Deploys to Base Sepolia testnet
- `npm run deploy:mainnet` - Deploys to Base mainnet
- Local development: `npx hardhat node` then `npx hardhat deploy --network localhost`

### Webapp Commands

- Webapp commands should be run from the `webapp/` directory:
  - `cd webapp && npm run dev` - Starts Next.js development server
  - `cd webapp && npm run build` - Builds webapp for production
  - `cd webapp && npm install` - Installs webapp dependencies

### Development Utilities

- Various utility scripts available in `scripts/` directory
- For minting tokens locally: `node scripts/mint-local-batch.js`
- For event monitoring: `node scripts/events/index.mjs`

## Architecture Overview

### Project Phases

**Phase 1 (Complete)** - Carbon offset NFT marketplace with Dutch auction pricing on Base mainnet
**Phase 2 (Implementation Complete)** - EcoStabilizer Vault system for NFT collateralization

### Smart Contracts

- **AstaVerde.sol** - Phase 1: Main ERC-1155 contract (deployed, unchanged in Phase 2)
- **StabilizedCarbonCoin.sol** - Phase 2: ERC-20 debt token with MINTER_ROLE exclusively for vault
- **EcoStabilizer.sol** - Phase 2: Vault contract enabling 1:1 NFT collateralization for 20 SCC loans
- **EcoStabilizerV2.sol** - Phase 2: Enhanced vault with batch operations support
- **IAstaVerde.sol** - Phase 2: Interface extending IERC1155 for vault integration
- **MockUSDC.sol** - Testing utility

### Phase 1 Contract Architecture (Live)

- ERC-1155 batch-efficient NFT operations
- Dutch auction: starts at base price, decreases 1 USDC daily until 40 USDC floor
- Base price adjusts: +10 USDC for quick sales (within 2 days), -10 USDC after 4 days stagnation
- Platform commission: 30% default, remainder to producers

### Phase 2 Vault Architecture (Implementation Complete)

- **Non-fungible CDPs**: Each EcoAsset NFT = unique collateral for distinct 20 SCC loan
- **Fixed issuance rate**: SCC_PER_ASSET = 20 \* 1e18 (eliminates oracle dependency)
- **No liquidations**: Users always reclaim their exact original NFT
- **Redeemed asset protection**: Only un-redeemed EcoAssets accepted as collateral
- **SCC price peg**: Market arbitrage between 20 SCC and new EcoAsset primary market price
- **Admin controls**: Pause/unpause functionality, emergency NFT sweep for unsolicited transfers
- **Security features**: Reentrancy protection, comprehensive access control, supply cap enforcement

### Webapp Structure

- **Next.js 14** app with TypeScript and Tailwind CSS
- **Wagmi/Viem** for Web3 integration with ConnectKit wallet connection
- **TanStack Query** for data fetching and caching
- Multi-chain support (local, Base Sepolia, Base mainnet)
- IPFS integration for NFT metadata with multiple gateway fallbacks

### Key Configuration

- Environment variables in `.env.local` and `webapp/.env.local`
- Contract addresses and chain selection via `webapp/src/app.config.ts`
- Network configurations in `hardhat.config.ts` for Base mainnet/testnet

### Deployment Architecture

- Uses `hardhat-deploy` for deterministic deployments
- Phase 1: AstaVerde deployed and live on Base mainnet
- Phase 2: Deploy SCC → EcoStabilizer → grant MINTER_ROLE → renounce admin roles
- Contract artifacts automatically copied to webapp config during compilation
- Multi-network deployment with verification on Base explorers

### Development Patterns

- Contract events monitored via scripts in `scripts/events/`
- Batch minting utilities for carbon offset data
- IPFS content uploading via Web3.Storage integration
- Gas targets for Phase 2: <150k deposit, <120k withdraw

### Testing Strategy

**Comprehensive Test Suite (173 tests, all passing):**

- `AstaVerde.ts` & `AstaVerde.logic.behavior.ts` - Phase 1 marketplace functionality
- `EcoStabilizer.ts` - Core vault operations (deposit, withdraw, admin functions)
- `StabilizedCarbonCoin.ts` - SCC token functionality and security
- `IntegrationPhase1Phase2.ts` - Cross-phase interaction testing
- `VaultBoundaries.ts` - Edge cases and boundary conditions
- `VaultDirectTransfer.ts` - Direct NFT transfer handling
- `VaultRedeemed.ts` - Redeemed asset protection
- `VaultReentrancy.ts` - Reentrancy attack protection
- `VaultCoverageGapsFixed.ts` - Complete code coverage
- `SCCInvariants.ts` - Supply invariant and ghost supply scenarios
- `SecurityDeployment.ts` - Production deployment security
- `HelperTest.ts` - Testing utilities

**Test Documentation:**

- `TESTING_GUIDE.md` - Comprehensive testing methodology
- `INTEGRATION_TESTING.md` - Phase integration testing strategy
- `README.md` - Test suite overview

**Coverage Analysis:**

- Complete branch and statement coverage via solidity-coverage
- Gas usage analysis with hardhat-gas-reporter
- Security-focused edge case testing

### Phase 2 Implementation Requirements

- IAstaVerde interface must inherit from IERC1155 for proper compilation
- Vault deployment references existing AstaVerde contract address
- SCC minting exclusively controlled by vault (no other minters)
- Admin functions: pause/unpause, emergency NFT sweep for unsolicited transfers

## Special Notes

- **Phase 1 is live and unchanged** - AstaVerde contract deployed on Base mainnet
- **Phase 2 current focus** - Implementing vault system per SSC_PLAN.md specifications
- **Phase 2 changes uncommitted** - Use `git status` and `git diff` to see current vault implementation progress
- Always run `npm run compile` after contract changes to update webapp configs
- Only un-redeemed EcoAssets can be deposited as vault collateral (enforced on-chain)
- Vault enables fixed 20 SCC loans against individual NFTs (no liquidations)
- When testing locally, use `npm run task:mint:local` to create test NFTs
- Base network is production target, Sepolia for testing

## Phase 2 Implementation Status

**Phase 2 Vault System - IMPLEMENTATION COMPLETE**

All core Phase 2 functionality has been implemented and thoroughly tested:

**Smart Contracts (Complete):**

- ✅ `contracts/StabilizedCarbonCoin.sol` - ERC-20 debt token with access control
- ✅ `contracts/EcoStabilizer.sol` - Vault contract with full functionality
- ✅ `contracts/IAstaVerde.sol` - Interface for vault integration
- ✅ All security features: reentrancy protection, access control, supply caps
- ✅ Gas optimization: deposit <150k, withdraw <120k gas

**Testing Suite (Complete):**

- ✅ 173/173 tests passing with comprehensive coverage
- ✅ Security testing: reentrancy, access control, boundary conditions
- ✅ Integration testing: Phase 1 ↔ Phase 2 interactions
- ✅ Edge cases: redeemed assets, direct transfers, invariants
- ✅ Production deployment scenarios and role management

**Deployment Infrastructure (Complete):**

- ✅ `scripts/deploy_ecostabilizer.ts` - Production deployment script
- ✅ Multi-network support (local, testnet, mainnet)
- ✅ Role-based deployment with proper access control setup

**Webapp Integration (Partial - UI Implementation Needed):**

- ✅ Contract configurations in `webapp/src/app.config.ts`
- ✅ Contract interaction setup in `webapp/src/lib/contracts.ts`
- ✅ ABI generation: `webapp/src/config/EcoStabilizer.json`, `StabilizedCarbonCoin.json`
- ⏳ Vault UI components (`VaultCard.tsx`, `useVault.ts`) referenced but need implementation

**Remaining Tasks:**

- Frontend vault UI implementation (deposit/withdraw interface)
- Production deployment to Base mainnet
- User documentation for vault functionality

Phase 2 smart contracts are production-ready with comprehensive security testing.

## Dependency Management & Security

**Recent Updates (2025-01-07):**

- All dependencies updated to latest secure versions
- Critical security vulnerabilities eliminated (26 → 7)
- Major version updates: Hardhat toolbox 6.1.0, chai 5.2.1, viem 2.33.3
- Next.js configured to handle viem/ox type compatibility issues
- Build verification scripts added to prevent Vercel deployment failures

**Security Status:**

- Zero production security risks
- Remaining 7 vulnerabilities are in development-only tools (hardhat-deploy, solc)
- All 173/173 tests passing with updated dependencies

**Best Practices:**

- Always run `npm run verify:deploy` before pushing major changes
- Dependencies are pinned to specific secure versions
- Regular security audits via `npm audit` show acceptable risk levels

- The developer takes care of running the local dev stack themselves, so don't run it.