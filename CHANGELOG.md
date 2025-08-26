# Changelog

All notable changes to the AstaVerde project are documented in this file.

## [Unreleased] - 2025-08-26

### Development Infrastructure

#### Added
- **ABI Validation System**: Comprehensive validation to prevent deployment issues
  - `npm run validate:abis` - Validates all contract ABIs are properly generated
  - `scripts/deploy-with-validation.js` - Enhanced deployment with automatic ABI validation
  - Automatic compilation before local development starts
  - Ensures critical functions like `getUserLoansIndexed` are present in ABIs

#### Fixed
- Fixed `getUserLoansIndexed` ABI generation issue that caused webapp errors
- Enhanced `start-local.js` to compile contracts before deployment
- Updated deployment scripts to ensure ABIs are always current

#### Changed
- `npm run dev:local` now automatically compiles contracts first
- `npm run deploy:testnet` and `npm run deploy:mainnet` now use validated deployment
- Added `npm run deploy:safe` for safer deployments with validation

## v2 – 2025-08-25

### Contracts

#### Added
- Pull-payment accounting for producers via `producerBalances` and `claimProducerFunds()` to prevent marketplace disruption. Events: `ProducerPaymentAccrued`, `ProducerPaymentClaimed` — Why: Previously, a malicious producer could block all sales by making their wallet reject payments. Now producers must actively claim their earnings, isolating any payment failures to individual accounts.
- Surplus USDC recovery with `recoverSurplusUSDC()`; only USDC above accounted balances (platform + producers) can be recovered — Why: if someone accidentally sends USDC directly to the contract, this allows recovery of those funds while protecting all legitimately owed payments.
- Gas-bounded pricing updates with `maxPriceUpdateIterations` and `setMaxPriceUpdateIterations()`. Events: `PriceUpdateIterationLimitReached`, `MaxPriceUpdateIterationsSet` — Why: limits transaction costs by capping how many price calculations occur per purchase, preventing unexpectedly expensive transactions while maintaining pricing accuracy over time.
- Batch participation tracking for price decreases via `batchUsedInPriceDecrease`. Event: `BatchMarkedUsedInPriceDecrease` — Why: ensures each unsold batch can only trigger one price decrease, preventing market manipulation through repeated price drops.
- Deployment guardrails: strict USDC validation (6 decimal places) and canonical Base mainnet USDC enforcement (`BASE_MAINNET_USDC`) — Why: ensures only the official USDC token is used, preventing deployment errors that could break financial calculations.
- Additional view/helpers: `getProducerBalance()`, `getBatchInfo()`, `isRedeemed()` — Why: provides stable, low-coupling integration points for the vault and frontend.
- NFT receiver protection: only accepts transfers from our own contracts, blocking external NFT deposits — Why: prevents spam attacks where malicious actors send unwanted NFTs to clog the system.
- Admin tunables and events: `setAuctionDayThresholds()`, `setDailyPriceDecay()`. Events: `PlatformPriceFloorAdjusted`, `BasePriceForNewBatchesAdjusted`, `DailyPriceDecaySet`, `PriceDeltaSet`, `MaxBatchSizeSet`, `PlatformFundsClaimed` — Why: gives operations clear levers and observability to tune market behavior safely.

#### Changed
- Payment flow in `buyBatch()` now pulls the full `usdcAmount`, accrues producer payments (pull-pattern), and refunds any excess to the buyer; platform fees accumulate in `platformShareAccumulated` and are withdrawn via `claimPlatformFunds()` — Why: eliminates security vulnerabilities in refund handling and follows best practices for smart contract payment processing.
- Dynamic base price algorithm: 
  - Increases by 10 USDC when recent batches sell quickly (within 2 days, checking up to 10 most recent batches).
  - Decreases by 10 USDC when batches remain completely unsold beyond 4 days, with a 90-day maximum lookback period.
  - Why: Automatically adjusts pricing based on actual market demand while keeping transaction costs predictable.
- `mintBatch()` enforces metadata size limits and locks the current market price as each batch's starting price — Why: prevents system abuse through oversized data uploads and ensures consistent pricing for each batch.
- `recoverERC20()` explicitly blocks USDC recovery; use `recoverSurplusUSDC()` instead — Why: protects user funds by ensuring the contract never withdraws money that's owed to producers or the platform.
- Platform fee cap reduced to 50% via `setPlatformSharePercentage()` guard — Why: enforces policy ceilings and user protection at the contract level.

#### Fixed/Hardening
- Comprehensive protection against reentrancy attacks (double-spending) on all payment functions.
- Mathematically precise fund distribution to producers, handling rounding correctly.
- Enhanced input validation to prevent invalid operations.

#### Security & Ops
- Emergency pause via `ERC1155Pausable`; critical actions guarded with `onlyOwner`.
- Bounded loops for price updates to prevent gas-related DoS; operational tuning via `maxPriceUpdateIterations`.
- Clear operational events for observability: sales, price adjustments, iteration limits, and fund movements.

#### New contracts
- **EcoStabilizer.sol** — NFT collateralization vault — Why: enables users to get loans using their carbon NFTs as collateral, without risk of losing them (no liquidations).
  - Each carbon NFT can be locked to borrow 20 SCC tokens (Stabilized Carbon Coins)
  - Users can always reclaim their exact original NFT by repaying the loan
  - Security features prevent double-spending and protect against attacks
  - Admin can pause system in emergencies and remove spam NFTs
  - Only accepts unused (non-redeemed) carbon credits as collateral

- **IAstaVerde.sol** — Standard interface for carbon NFT contract — Why: provides a stable way for other contracts to interact with the marketplace.
  - Allows checking if carbon credits have been redeemed
  - Provides token information needed by the vault

- **StabilizedCarbonCoin.sol** — SCC token used as loan currency — Why: creates a controlled token that only the vault can issue, with a hard cap of 1 billion tokens.
  - Standard ERC-20 token with 18 decimal places
  - Only the vault contract can create new SCC tokens
  - Users receive SCC when depositing NFTs, burn SCC when withdrawing
  - Admin rights permanently removed after deployment for security

### Webapp

#### Added
- Producer dashboard (`/producer` route) with claimable USDC and one-click claim — Why: gives producers easy access to view and claim their earnings.
- `useIsProducer` hook with conditional navigation — Why: detects producer wallets to expose relevant actions without cluttering UI for non-producers.
- Vault UI integration for EcoStabilizer (deposit/withdraw SCC loans) — Why: allows users to get loans against their NFTs directly through the web interface.
- Batch vault operations (bulk deposit/withdraw) — Why: reduces transaction overhead and improves UX for power users.
- Admin gas controls for `maxPriceUpdateIterations` — Why: allows admins to balance transaction costs against pricing accuracy during high activity.
- Surplus USDC recovery UI — Why: safe recovery of accidental transfers with clear accounting.
- NFT approval validation before deposits — Why: prevents failed txs by ensuring permissions up front.
- Comprehensive vault error handling — Why: improves user feedback and reduces failed-flow confusion.
- Security headers (CSP, X-Frame-Options) — Why: strengthen webapp security posture for production.

#### Changed
- Migrated from Biome to ESLint — Why: unify linting stack and reduce tooling friction.
- Standardized to 2-space indentation — Why: consistent formatting improves diffs and readability.
- Updated dependencies (wagmi/viem v2.x, Next.js 14) — Why: resolve build issues and align with ecosystem updates.
- Modularized MyTokens page — Why: maintainability and performance via smaller components and hooks.
- Admin platform fee validation (0-50% max) — Why: reflect on-chain caps in UI to prevent invalid txs.
- Exact USDC calculation in `buyBatch()` — Why: avoid unnecessary refunds and edge-case failures.
- Simplified to single vault system — Why: reduce complexity; dual-routing removed as unnecessary.
- Global event listener management — Why: prevent memory leaks and ensure cleanup.
- IPFS gateway fallbacks — Why: improve metadata reliability across networks.

#### Removed
- pnpm (replaced with npm) — Why: build consistency with Vercel and CI.
- Legacy utilities and deprecated exports — Why: reduce maintenance surface and confusion.
- Fee-on-transfer token compatibility code — Why: canonical USDC has no transfer fees; simplifies logic.

### Development

#### Added
- Comprehensive test suite including security and integration tests — Why: ensures all critical features work correctly and prevents bugs.
- Attack simulation contracts (`MaliciousProducer.sol`, `MaliciousVaultReceiver.sol`) — Why: tests defenses against malicious actors.
- Coverage gap tests (`AstaVerdeCoverageGaps.test.ts`) — Why: close untested paths in pricing/admin flows.
- Direct transfer recovery tests — Why: verify surplus USDC recovery scenarios.
- QA scripts (`qa:status`, `qa:fast`, `qa:full`) — Why: fast health checks and full verifications pre-deploy.
- Event monitoring scripts — Why: enhance observability during ops.
- Build verification scripts — Why: catch integration issues early.
- Local dev utilities — Why: accelerate manual QA and demos.
- Comprehensive docs (testing, integration, deployment) — Why: support handoff and ongoing ops.

#### Changed
- Migrated from Biome to ESLint across codebase — Why: unify tooling.
- Replaced pnpm with npm lockfiles — Why: improve build compatibility across envs.
- Updated dependencies — Why: security patches and compatibility.
- Reorganized documentation — Why: easier navigation and domain clarity.
- Simplified README — Why: production-focused overview with links to detailed docs.

#### Removed
- Obsolete deployment scripts (`deploy.sh`, `mint.sh`, `mint_local.sh`) — Why: replaced by Hardhat scripts.
- Legacy fee-on-transfer mock contracts (`AnotherERC20.sol`) — Why: non-applicable to canonical USDC.
- Biome linter configuration (`biome.json`) — Why: migrated to ESLint for consistency.
- Legacy test files (`AstaVerde.behavior.ts`, `AstaVerde.logic.behavior.ts`, `HelperTest.ts`) — Why: replaced with comprehensive new test suite.

### Breaking Changes

#### Contracts
- **Producer payments now require manual claiming** — Producers must call `claimProducerFunds()` to withdraw earnings instead of receiving automatic transfers. Impact: Producers need to actively claim their funds, but this prevents any single producer from breaking the entire marketplace.
- **USDC recovery method changed** — Must use `recoverSurplusUSDC()` instead of generic token recovery. Impact: Ensures accidental USDC transfers can be recovered without risking legitimate user funds.
- **External NFT transfers blocked** — Contract only accepts NFTs from its own operations. Impact: Prevents spam attacks but means users cannot directly transfer NFTs to the contract.
- **Strict USDC token validation** — Only official Base USDC accepted on mainnet. Impact: Prevents deployment errors and ensures correct financial calculations.
- **Vault integration simplified** — Removed direct vault coupling from marketplace. Impact: Cleaner architecture with better separation of concerns.
- **Standard USDC only** — No support for tokens with transfer fees. Impact: Simpler, more reliable code since official USDC has no transfer fees.

#### Webapp
- **New environment variables required** — Must add vault and SCC token addresses to configuration. Impact: Vault features won't work without these settings.
- **Producer payment UI changed** — Payments now shown in dedicated producer dashboard instead of transaction history. Impact: Producers need to visit their dashboard to view and claim earnings.
- **Manual NFT approval required** — Users must explicitly approve NFTs before vault deposits. Impact: Extra step for users but prevents accidental deposits and failed transactions.

## v1 – Initial release – 2024-11-15
- NFT marketplace for carbon offsets with automatic price adjustment (Dutch auction: prices decrease daily until sold).
- Batch minting for efficiency, time-based pricing with 40 USDC minimum, 30% platform fee.
- Carbon credits can be marked as "redeemed" (used for offsetting) but remain tradeable as collectibles.
