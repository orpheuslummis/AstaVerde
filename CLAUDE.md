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
- `npm run webapp:dev` - Starts Next.js development server
- `npm run webapp:build` - Builds webapp for production
- `npm run webapp:install` - Installs webapp dependencies

### Development Utilities
- `npm run watch` - Watches contracts, compiles and tests on changes
- `npm run task:mint:local` - Mints tokens locally for testing
- `npm run task:events` - Runs event monitoring scripts

## Architecture Overview

### Project Phases
**Phase 1 (Complete)** - Carbon offset NFT marketplace with Dutch auction pricing on Base mainnet
**Phase 2 (Current)** - EcoStabilizer Vault system for NFT collateralization

### Smart Contracts
- **AstaVerde.sol** - Phase 1: Main ERC-1155 contract (deployed, unchanged in Phase 2)
- **StabilizedCarbonCoin.sol** - Phase 2: ERC-20 debt token with MINTER_ROLE exclusively for vault
- **EcoStabilizer.sol** - Phase 2: Vault contract enabling 1:1 NFT collateralization for 20 SCC loans
- **IAstaVerde.sol** - Phase 2: Interface extending IERC1155 for vault integration
- **MockUSDC.sol** - Testing utility

### Phase 1 Contract Architecture (Live)
- ERC-1155 batch-efficient NFT operations
- Dutch auction: starts at base price, decreases 1 USDC daily until 40 USDC floor
- Base price adjusts: +10 USDC for quick sales (within 2 days), -10 USDC after 4 days stagnation
- Platform commission: 30% default, remainder to producers

### Phase 2 Vault Architecture (Current Development)
- **Non-fungible CDPs**: Each EcoAsset NFT = unique collateral for distinct 20 SCC loan
- **Fixed issuance rate**: SCC_PER_ASSET = 20 * 1e18 (eliminates oracle dependency)
- **No liquidations**: Users always reclaim their exact original NFT
- **Redeemed asset protection**: Only un-redeemed EcoAssets accepted as collateral
- **SCC price peg**: Market arbitrage between 20 SCC and new EcoAsset primary market price

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
- Comprehensive test suite in `test/` directory covering both phases
- Phase 2 essential tests: redeemed asset rejection, direct transfer handling
- Mock contracts for local development and testing
- Coverage analysis with solidity-coverage

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

## Current Development Status

Phase 2 vault system implementation is in progress. Key uncommitted changes:

**Contracts Added:**
- `contracts/StabilizedCarbonCoin.sol` - ERC-20 debt token
- `contracts/EcoStabilizer.sol` - Vault contract  
- `contracts/IAstaVerde.sol` - Interface for vault integration

**Deployment:**
- `deploy/deploy_ecostabilizer.ts` - Vault deployment script

**Tests Enhanced:**
- Major refactoring of `test/AstaVerde.logic.behavior.ts` with improved price adjustment logic
- Removed legacy `test/AstaVerde.behavior.ts` 
- Added shared utility functions and better test organization
- Test coverage for vault integration points

**Webapp Integration:**
- Added EcoStabilizer and SCC contract addresses to `webapp/src/app.config.ts`
- Enhanced `webapp/src/lib/contracts.ts` with vault contract configurations  
- Added SCC balance display in `webapp/src/components/Header.tsx`
- Integrated `VaultCard` component in `webapp/src/app/mytokens/page.tsx`
- Created contract ABI configs: `webapp/src/config/EcoStabilizer.json`, `webapp/src/config/StabilizedCarbonCoin.json`

**Key Implementation Notes:**
- Vault integration hooks (`useVault.ts`) and UI components (`VaultCard.tsx`) are referenced but need implementation
- Contract ABIs automatically generated and copied to webapp config during compilation
- SCC balance shows in header when vault contracts are configured
- Package.json cleaned up (removed deprecated hardhat-ethers dependency)

Use `git diff` to see complete implementation details and identify remaining Phase 2 tasks per SSC_PLAN.md.