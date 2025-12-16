# AstaVerde v1 → v2 Changes (AstaVerde.sol only)

Scope: This document compares v1 on main (contracts/AstaVerde.sol in branch `main`) vs the current v2 contracts/AstaVerde.sol in this branch. It covers only the ERC‑1155 marketplace contract — no SCC/EcoStabilizer details.

## Executive Summary

- Payment flow: producers now use pull‑payments (claimable balances) instead of immediate transfers in `buyBatch()`.
- ERC‑1155 receiver hardening: contract only accepts its own tokens; third‑party ERC1155 “dust” is rejected.
- USDC safety: constructor validates 6‑decimals; on Base mainnet (chainid 8453) it also enforces canonical USDC; all transfers use SafeERC20. For other chains (e.g., Arbitrum), deploy scripts must supply the correct USDC address.
- Fairer producer distribution: rounding remainder goes to producers, not the platform; totals are verified to the cent.
- Bounded pricing maintenance: `maxPriceUpdateIterations` caps loop work in `updateBasePrice()` to avoid DoS.
- Stronger parameter guards: platform fee capped at 50%; base price/floor consistency checks; batch size limited to 1–100.
- Underflow guard in price decay prevents revert in extreme scenarios.
- Public `tokens` mapping is now private; new read APIs expose needed fields without leaking internal layout.
- Event updates: `BasePriceForNewBatchesAdjusted` removed; continue using `BasePriceAdjusted`; plus new producer accrual/claim and iteration‑limit events.

## API Surface Changes

Added

- `getTokenProducer(uint256) → address`: returns producer for a token.
- `getTokenCid(uint256) → string`: returns IPFS CID for a token.
- `isRedeemed(uint256) → bool`: redemption status via a stable interface.
- `claimProducerFunds()`: producers withdraw accrued USDC (pull‑payments).
- `getProducerBalance(address) → uint256`: producer’s claimable balance.
- `recoverERC20(address token, uint256 amount, address to)`: recover non‑USDC tokens sent by mistake.
- `recoverSurplusUSDC(address to)`: withdraw USDC above accounted balances (platform + producers) only.
- `setMaxPriceUpdateIterations(uint256)`: caps loop work in `updateBasePrice()`; emits `MaxPriceUpdateIterationsSet`.
- `onERC1155Received` / `onERC1155BatchReceived`: only accepts tokens from self; rejects external ERC1155.

Changed

- `buyBatch(batchID, usdcAmount, tokenAmount)`:
    - Pulls full `usdcAmount` via `safeTransferFrom`, accrues producer shares, then refunds any excess.
    - Producer payments accrue to balances; producers call `claimProducerFunds()` to withdraw later.
    - Emits producer accrual events; batch sold/partial events emitted after transfers succeed.
- `setPlatformSharePercentage(uint256)`: now requires `<= 50` (v1 allowed `< 100`).
- `setPriceFloor(uint256)`: floor must be `> 0` and `<= basePrice`.
- `setBasePrice(uint256)`: must be `>= priceFloor`; emits `BasePriceAdjusted(newPrice, ts, increased)` (replaces v1 event).
- `setMaxBatchSize(uint256)`: constrained to `1..100`.
- `getCurrentBatchPrice(uint256)`: adds underflow guard when decay exceeds starting price.
- `redeemToken(uint256)`: validates token existence via `lastTokenID` and uses private storage.
- `claimPlatformFunds(address)`: callable even when paused (emergency access to already‑earned platform fees).

Rationale notes (changed items)

- Platform share cap (≤50%): protects producer incentives and avoids misconfiguration; see ticket 015.
- Max batch size (1–100): bounds gas/UX risks from oversized batches; see ticket 037.
- Base/Floor guards and SafeERC20: enforce economic invariants and safer token I/O; see tickets 303 and 113.
- Event emission after transfers: cleaner CEI order and observability; see ticket 005.

Removed/Deprecated

- Event `BasePriceForNewBatchesAdjusted` (use `BasePriceAdjusted`).
- Errors `NotProducer`, `NotTokenOwner` (replaced with explicit `require` checks).
- Mapping `batchCreationIndex` (unused in v2).

## Storage and Constants

- `tokens` mapping: now `private` with a slimmer `TokenInfo`:
    - v1: `{ owner, tokenId, producer, cid, redeemed }`
    - v2: `{ originalMinter, producer, cid, redeemed }` (no `tokenId`/`owner` field; owner is derived via balances)
- New accounting: `mapping(address => uint256) producerBalances; uint256 totalProducerBalances`.
- New constants: `MAX_CID_LENGTH = 100`, `BASE_MAINNET_USDC` (canonical USDC on Base mainnet; used only when `block.chainid == 8453`).
- Removed: `INTERNAL_PRECISION`, `PRECISION_FACTOR` (USDC‑only math).
- New control: `uint256 public maxPriceUpdateIterations = 100`.

Why it changed

- Private `tokens` prevents integrators from binding to internal layout and removes the stale `owner` field that caused confusion; use view functions instead. See ticket: 501 (owner field misuse risk).
- `MAX_CID_LENGTH` caps CID size to guard against storage/log bloat and indexer breakage; valid IPFS CIDs are well under this bound.

## Behavioral Differences

- Producer payouts
    - v1: immediate `transfer()` to producers in `buyBatch()`.
    - v2: accrue balances; producers call `claimProducerFunds()` (pull‑pattern prevents DoS if a recipient reverts).
    - Why it changed: Push payments let a reverting producer block purchases and increase failure surface. Pull‑payments isolate risk and follow best practice; also complements the overpayment fix to centralize fund flow (pull full amount, then refund). See tickets: 001 (overpayment/flow context), 303 (SafeERC20 migration).
- Rounding fairness
    - v1: rounding residue from per‑token splits added to platform share.
    - v2: residue is assigned to producers (deterministic remainder to first producer) and verified: `distributed + platform == total`.
    - Why it changed: Removes implicit “rounding tax” to the platform and enforces an explicit accounting invariant so totals always reconcile. See ticket: 304 (rounding correctness).
- ERC1155 receiving
    - v1: inherited default acceptor; third‑party ERC1155 could be sent (“dust”).
    - v2: receiver functions restrict to self‑originating transfers (mint/self‑transfer only).
    - Why it changed: Prevents dusting/griefing and blocks the path for redeemed NFTs being transferred back and inadvertently resold; only mint/self‑transfers are accepted. See ticket: 002 (redeemed resale/dusting risk).
- Pricing maintenance
    - v1: unbounded scan within window; no iteration cap.
    - v2: bounded by `maxPriceUpdateIterations`; emits `PriceUpdateIterationLimitReached` and per‑batch `BatchMarkedUsedInPriceDecrease`.
    - Why it changed: Caps gas to avoid DoS as historical batches grow, preserving predictable user costs while accepting “eventual consistency” in adjustments. See tickets: 004 and 107 (iteration DoS fix) and 108 (documented trade‑off).
- Paused behavior
    - v1: `claimPlatformFunds()` blocked by `whenNotPaused`.
    - v2: allowed during pause for operational continuity; fund flows remain confined to accounted platform fees.
    - Why it changed: Incident response and business continuity require access to already‑earned platform fees even if trading is paused. See ticket: 003 (pause/vault operational risks; Option 5 notes funds during pause).

## Events

- Replaced: `BasePriceForNewBatchesAdjusted` → `BasePriceAdjusted(newBasePrice, timestamp, increased)`.
- New: `ProducerPaymentAccrued`, `ProducerPaymentClaimed`, `MaxPriceUpdateIterationsSet`, `PriceUpdateIterationLimitReached`, `BatchMarkedUsedInPriceDecrease`, `SurplusUSDCRecovered`.
- Unchanged: `PlatformSharePercentageSet`, `PlatformPriceFloorAdjusted`, `BatchMinted`, `BatchSold`, `PartialBatchSold`, `TokenRedeemed`, `PriceDeltaSet`, `PlatformFundsClaimed`, `MaxBatchSizeSet`, `DailyPriceDecaySet`.

## Parameter Defaults (unchanged from v1)

- `platformSharePercentage = 30` (but hard‑capped at 50 in v2).
- `maxBatchSize = 50`.
- `basePrice = 230 USDC`, `priceFloor = 40 USDC`, `dailyPriceDecay = 1 USDC/day`.
- `priceAdjustDelta = 10 USDC`, `dayIncreaseThreshold = 2`, `dayDecreaseThreshold = 4`.

## Security Improvements

- Safe token handling: `SafeERC20` for transfers; constructor enforces `decimals()==6` and (on Base mainnet only) canonical USDC when `block.chainid == 8453`.
- DoS resistance: bounded iteration via `maxPriceUpdateIterations` in price update logic.
- Underflow prevention: explicit guard in decayed price calculation.
- Receiver hardening: rejects external ERC1155 tokens to avoid dusting/griefing vectors.
- Pull‑payments: reverts at producer addresses no longer block user purchases.

Justification & references

- SafeERC20 + USDC assumptions: 113 (fee‑on‑transfer risk) and 303 (migrate to SafeERC20); 502 (document 6‑decimals requirement).
- Price iteration cap and trade‑offs: 004 (fix), 107 (fix), 108 (wontfix note on eventual consistency).
- Underflow guard in price decay: 006 (prevent price underflow DoS on old batches).
- ERC1155 receiver restrictions: 002 (prevent dusting and redeemed resale path).
- Platform funds during pause: 003 (operational continuity under pause).

## Migration Notes for Integrators

- Reading token metadata:
    - v1: `tokens(tokenId).producer` / `tokens(tokenId).cid` (public struct).
    - v2: use `getTokenProducer(tokenId)` and `getTokenCid(tokenId)`.
- Redemption checks: replace direct struct reads with `isRedeemed(tokenId)`.
- Producer payouts: index on `ProducerPaymentAccrued` and `ProducerPaymentClaimed` instead of `ProducerPayment`.
- Pricing updates: listen to `BasePriceAdjusted` (single event) instead of v1’s base‑price‑for‑new‑batches event.
- Gas at purchase: `buyBatch()` may include additional work for price updates; consider sending the exact `usdcAmount == price*qty` computed via `getCurrentBatchPrice()` to avoid unnecessary refund paths.

## Non‑Goals of This Doc

- No SCC or vault/EcoStabilizer details; this is limited to AstaVerde.sol.
- No webapp or deployment workflows.

— Updated: 2025‑08‑30
