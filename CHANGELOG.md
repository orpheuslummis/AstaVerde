# Changelog

All notable changes to the AstaVerde project are documented in this file.

## Ethereum mainnet redeploy – 2026-09 (in progress, branch `ethereum`)

The marketplace moves from Arbitrum One to Ethereum mainnet by fresh deploy. The Arbitrum
deployment stays where it is; no tokens or history are migrated. The smart contracts are not
modified. This section is the client-readable summary; the engineering record is in
`JOURNAL.md` and `journal/`.

### Networks and deployment

#### Added

- Hardhat networks `ethereum-sepolia` (chain 11155111, the QA testnet) and `ethereum-mainnet` (chain 1) — Why: the deploy tooling only knew Base and Arbitrum.
- Circle USDC on Ethereum mainnet (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`) as the payment token in the deploy script's native-USDC map. On Sepolia a MockUSDC is deployed automatically for testing — Why: same pattern as Arbitrum: canonical USDC on mainnet, a mintable test token on the testnet.
- Env templates `.env.ethereum-sepolia.example` and `.env.ethereum-mainnet.example` with every deploy flag named — Why: mainnet flags (`DEPLOY_VAULT_V2`, `RENOUNCE_SCC_ADMIN` / `TRANSFER_SCC_ADMIN`) must be explicit, not inherited.
- `npm run handoff` (`scripts/handoff.js`): transfers ownership of AstaVerde and the EcoStabilizer vault to a new owner, optionally moves or renounces the SCC admin role, and reads every owner and role back on-chain before reporting success — Why: in December the vault ownership had to be transferred by hand; the mainnet handoff should be one command with a built-in check.
- The deploy script transfers vault ownership to `OWNER_ADDRESS` when one is set — Why: the vault is owned by whoever deploys it; AstaVerde already took its owner as a parameter, the vault did not.
- Deployment records for Ethereum (`deployments/ethereum-sepolia/`, later `deployments/ethereum-mainnet/`) are now tracked in git — Why: the Arbitrum addresses were only ever on one laptop.
- Ethereum Sepolia QA deployment (2026-09-20, second deploy, includes the pause-exit fix), all four contracts verified on Sepolia Etherscan: AstaVerde `0x088c523088389a4E6a69A8a2Cc7E765EB1038523`, StabilizedCarbonCoin `0xB31D17B9BA321D576dC9B3d90a7D0F79ceB265BD`, EcoStabilizer `0x0eFDfD5b07Cd1717eb822Ed4A73924F1070F13eB`, MockUSDC `0xB72FAA704cd5b39E4a04D89F913567C8a6D8cC5d`. The first deployment of the same night (AstaVerde `0xd594…3eD0`) carried the pre-fix bytecode and is abandoned.

#### Changed

- `npm run deploy:testnet` / `deploy:mainnet` / `mint:testnet` now target Ethereum. The Arbitrum commands remain as `deploy:arbitrum-testnet`, `deploy:arbitrum-mainnet`, `mint:arbitrum-testnet` — Why: the default should be the live target; the old ones stay reachable for the Arbitrum deployment.
- Contract verification uses Etherscan's V2 API with a single `ETHERSCAN_API_KEY` — Why: the old per-explorer keys hit Etherscan's retired V1 endpoint and failed on the first Sepolia deploy.

#### Fixed

- The deploy script waited for the SCC minter-role transaction to be sent, not mined, before checking it. Harmless on Arbitrum's sub-second blocks; on Ethereum's 12-second blocks it would have aborted a mainnet deploy with `RENOUNCE_SCC_ADMIN=true` — Why: the check read stale state.
- A USDC token with the wrong number of decimals now aborts the deploy instead of printing a warning — Why: the check threw inside its own error handler, so it could never fail.
- The deploy wrapper now exits with an error if a post-deployment step fails, instead of always printing success.
- Helper scripts (`set-metadata-uri`, `check-vault-tokens`, `check-nft-metadata`, `dev-sepolia`) read `sepolia` as Ethereum Sepolia; `arbitrum-sepolia` stays explicit.

### Web app

#### Added

- Ethereum mainnet and Ethereum Sepolia as selectable chains: RPC configuration, wallet chain list, testnet detection, Etherscan links, and the admin test-USDC faucet on Sepolia.

#### Changed

- All user-facing copy now names Ethereum and Circle USDC: page metadata, the welcome modal, the About page FAQ and the required-USDC paragraph. The Arbitrum-only warning about bridged USDC.e is removed — Why: it does not apply on mainnet.
- Two About-page items await the client's wording and are marked in the code: the first FAQ item (the old question was Arbitrum-specific) and the "how to get USDC into your wallet" section (the CowSwap and Revolut walkthroughs were Arbitrum routes). The eco-asset PDF may also need a new version.

#### Fixed

- Transaction confirmation waits up to about three minutes in total instead of 100 seconds, and a transaction that is still pending is reported as pending, not failed — Why: Ethereum blocks take 12 seconds; the old budget was tuned for Arbitrum's sub-second blocks. Retries only re-check the receipt and never re-send.
- A reverted transaction is reported as reverted immediately — Why: it used to be caught by the retry loop and surface as a timeout.
- "Marketplace is paused" and "Not enough tokens available" now reach the user before the wallet prompt — Why: those checks threw inside a handler that discarded them.
- Vault gas fallbacks raised (withdraw 120k → 160k, deposit 230k → 280k) — Why: the old withdraw fallback was below the measured worst case.

### Documentation and scripts

#### Changed

- README, AGENTS.md, the developer and QA guides, the testing and metadata guides, and the scripts READMEs now describe Ethereum Sepolia as the testnet and Ethereum mainnet as the target, with Arbitrum labelled as the previous target — Why: every guide still said Arbitrum Sepolia.
- README no longer claims "automated admin renunciation": the SCC admin role is renounced only when `RENOUNCE_SCC_ADMIN=true` on a non-test network — Why: the claim did not match the deploy script.
- Thirteen dead command references in the docs replaced with the commands that exist.
- Pricing guide: a dated note that the iteration-cap and batch-size advice was written for L2 gas and is under review for L1.

#### Archived (moved to `scripts/archive/`, nothing deleted)

- `mint.mjs`, `testmint.mjs` (Base-only, random producer addresses), `verify-vault.js` (calls a getter that does not exist), `smoke_test_vault.mjs` (assertions that cannot fail), `seed-local.js` (calls `ownerOf` on an ERC-1155) — Why: broken or Base-era; each is listed with its reason in `scripts/archive/README.md`.

### Contracts

One targeted change, everything else unchanged. A mechanism-level examination of the contracts
(journal entry `2026-09-20-agent-contracts-review.md`) found no bug in what the code does, re-confirmed
the accounting invariant and the closed refund-siphon fix, and found one documented-as-fixed issue
that was never fixed. The rest of its output is settings and runbook steps for mainnet.

#### Fixed

- Pausing no longer traps vault collateral. `EcoStabilizer.withdraw` and `withdrawBatch` work while the vault is paused (deposits stay blocked), and AstaVerde gains `trustedVault`: while the marketplace is paused, the vault can still return NFTs to their owners; every other transfer stays blocked, and deposits into the vault stay blocked too — Why: ticket 003 (2025-08) recorded this as fixed, but the code was never written; an emergency pause of either contract would have locked every user's collateral with no exit. The deploy script sets `trustedVault` and the handoff script refuses to transfer ownership without it. 8 new tests; the one existing test that asserted the old behaviour was updated. Mainnet bytecode therefore differs from the Cantina-audited Arbitrum contracts by this change alone.

#### Settings and runbook

- `maxPriceUpdateIterations` set to 25 by the owner right after handoff (the default 100 was tuned for L2 gas; on Ethereum it can add over 1M gas to a buyer's purchase when many batches sit unsold) — Why: caps the buyer's gas tax at about 230k while keeping price updates working for up to 25 live batches per quarter.
- `maxBatchSize` stays at 50 — Why: a 100-token mint is 21M gas, a third of an Ethereum block.
- SCC admin role: recommend renouncing at deploy rather than keeping it — Why: the vault address is fixed, so the role has no legitimate future use and could mint unlimited SCC if the key leaked.
- Three behaviours the client should know: pausing either contract freezes vault collateral with no user exit; the owner key can re-price all open inventory to near zero, so the owner should be a multisig; USDC accrued to a producer that Circle blocklists is stranded.

### Dependencies

#### Changed

- `npm audit fix` (no forced upgrades) at the root and in the webapp; seven unused root dependencies removed; OpenZeppelin pinned to the exact version the contracts were compiled with (5.4.0, bytecode unchanged); wagmi pinned to 2.16.1 because the newer connector package breaks the build — Why: cuts open advisories from 131 to 86 and removes every critical from the deploy tooling. The one remaining critical is Next.js 14 itself, whose fix is the Next 15 migration, a separate job (blocked on React 19 and connectkit). The webapp's viem moved 2.33 → 2.56, so the Sepolia QA round doubles as the wallet-flow test for it.
- Webapp `engines.node` pinned to 22.x — Why: Vercel's default is now Node 24 and local is 22; an unpinned project builds on whatever Vercel's default is that week.

### Still to come in this section

The Sepolia QA round; the mainnet deployment and handoff; the production cutover.

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
