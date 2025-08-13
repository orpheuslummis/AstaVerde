# TICKET: Fix AstaVerde front‑running in price updates without breaking API

- Priority: P0 (blocks tests and webapp if handled via breaking changes)
- Components: `contracts/AstaVerde.sol`, tests, webapp purchase flow
- Owner: Unassigned
- Created: 2025-08-13

---

## Problem

Phase 1 marketplace contract `AstaVerde` must remain backward compatible. A recent change introduced a new `buyBatch` signature with `maxPrice` and `deadline` and rearranged args. This adds slippage/deadline protection and fixes front‑running around base price updates, but it breaks existing integrations and tests that rely on the original signature.

Separately, the ordering of operations inside `buyBatch` must lock the buyer’s price for the current tx and only update `basePrice` for future batches, preventing price front‑running within the tx and across subsequent mints.

## Observed symptoms

- Tests and webapp paths that still call the original `buyBatch(batchID, usdcAmount, tokenAmount)` now fail with “no matching fragment”.
- Security regression tests expecting deadline behavior sometimes revert with “Transaction expired” because of mixed time sources and the signature change.

## Goals

1) Preserve Phase 1 API: keep the original `buyBatch(uint256 batchID, uint256 usdcAmount, uint256 tokenAmount)` signature working.
2) Maintain the front‑running hardening: lock `currentPrice` for the purchase; update base price for future batches before any external token transfers.
3) Offer optional slippage/deadline protection via a new function without breaking the original signature.
4) Keep gas within targets and retain SafeERC20 usage.

## Proposed change

- Restore the original `buyBatch(batchID, usdcAmount, tokenAmount)` ABI exactly as in Phase 1.
- Keep the internal operation ordering fix in place:
  - Compute and cache `currentPrice` for this batch.
  - Validate `usdcAmount == currentPrice * tokenAmount` (exact‑pull model, no overpayment acceptance).
  - Update sale state (remainingTokens, batchSoldTime, batchFinalPrice, lastCompleteSaleTime).
  - Call `updateBasePrice()` so that future batches reflect the new base price, while the current purchase pays the cached price.
  - Pull USDC via `safeTransferFrom`, distribute producer payouts, transfer NFTs.
- Introduce a new optional function (non‑breaking):
  - `buyBatchWithProtection(uint256 batchID, uint256 tokenAmount, uint256 maxPrice, uint256 deadline)`
  - Enforce `block.timestamp <= deadline` and `currentPrice <= maxPrice`.
  - Internally delegate to the same core implementation that the legacy function uses (with the price cached before `updateBasePrice()`).
- Mark the new function as Phase 2 only; webapp can adopt it opportunistically, but Phase 1 paths continue to use the original function.

## Acceptance criteria

- Original `buyBatch(uint256, uint256, uint256)` compiles and passes all existing tests that expect the old signature.
- New `buyBatchWithProtection` is available and covered by tests for slippage and deadline.
- The purchase price paid by the current buyer equals the pre‑update cached price; newly minted batches after the sale reflect the updated `basePrice`.
- No overpayment siphon; contract only pulls the exact required amount.
- All contract tests pass; webapp can continue to operate without code changes (legacy path). A follow‑up PR may start using `buyBatchWithProtection` in the webapp.

## Test plan

- Update or add tests to cover both signatures:
  - Legacy flow: `buyBatch(batchID, exactTotalCost, tokenAmount)` should succeed and charge exactly `currentPrice * tokenAmount`.
  - Protection flow: `buyBatchWithProtection(batchID, tokenAmount, maxPrice, deadline)`
    - Revert if `currentPrice > maxPrice`.
    - Revert if `block.timestamp > deadline`.
    - Succeed at boundary `block.timestamp == deadline`.
  - Front‑running ordering:
    - Verify purchase uses cached price and `basePrice` increases only for subsequent batches.
  - Overpayment resistance:
    - Approving more than needed does not change the pulled amount.
- Ensure previously failing tests in `test/*.ts` that used the legacy signature now pass without modification.

## Webapp impact

- No immediate changes required if we restore the original signature.
- Optional enhancement: add a codepath to use `buyBatchWithProtection` by supplying a user‑controlled slippage and an auto‑computed deadline, guarded by feature flag.

## Risks

- Dual API surface area. Mitigation: keep both functions internally calling a single core implementation to avoid drift.
- Confusion if webapp mixes signatures. Mitigation: document clearly and keep default path on legacy until Phase 2 rollout.

## Implementation checklist

- [ ] Restore original `buyBatch(batchID, usdcAmount, tokenAmount)` function.
- [ ] Add `buyBatchWithProtection(batchID, tokenAmount, maxPrice, deadline)` that wraps the same internal logic with additional guards.
- [ ] Ensure internal ordering: cache price → update sale state → `updateBasePrice()` → external transfers.
- [ ] Keep `SafeERC20` for all ERC‑20 interactions.
- [ ] Update tests:
  - [ ] Adapt slippage/deadline tests to call `buyBatchWithProtection`.
  - [ ] Keep legacy tests calling the original signature.
- [ ] Run full suite and confirm gas targets.
- [ ] Regenerate ABI in `webapp/src/config/AstaVerde.json` via `npm run compile`.

## References

- `contracts/AstaVerde.sol` — current ordering comment and implementation
- `test/SecurityRegressions.ts` — slippage/deadline tests
- `test/AstaVerde.logic.behavior.ts` — legacy signature usage
- `tickets/TICKET-001-buybatch-breaking-change.md` — related breaking‑change ticket

---

## Notes

This ticket intentionally separates the front‑running/ordering hardening from the ABI change. We keep the security fix while avoiding a breaking change by adding a new function for slippage/deadline instead of modifying the original.

