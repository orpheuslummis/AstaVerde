# 212 — [Critical] Remove invalid contract functions and stale allowlists (webapp)

Status: fixed (archived)
Severity: critical
Area: webapp/contracts-integration
Resolved: 2025-08-27

## Problem
The webapp references contract functions that do not exist or are not callable, and maintains stale allowlists that cause background read failures and broken admin actions.

- ERC‑721 function in ERC‑1155 app:
  - `tokenOfOwnerByIndex` is referenced in `AppContext` and listed in `READ_ONLY_FUNCTIONS`, but AstaVerde is ERC‑1155 and does not expose this function (not present in ABI).
- Nonexistent/private write:
  - `updateBasePrice` is exposed via admin controls, but in `contracts/AstaVerde.sol` it is `private` and not in the ABI. Attempts to call will always fail.
- Stale read names in allowlist:
  - `priceDelta`, `priceDecreaseRate`, `lastPriceChangeTime`, `pricingInfo`, and `tokenOfOwnerByIndex` are included under `READ_ONLY_FUNCTIONS` despite not existing in the current contract.

Impact: Background queries error noisily; admin action surfaces a failure; unnecessary RPC load; confusing UX and brittle code paths.

## Files
- `webapp/src/contexts/AppContext.tsx`
- `webapp/src/config/constants.ts`

## Steps to Reproduce
1) Start local stack: `npm run dev:local`.
2) Open the app and watch the browser console/network tab.
3) Observe failing contract reads for `tokenOfOwnerByIndex`. Navigate to Admin page and attempt the "Update Base Price" control (if present) — it fails.

## Fix Implemented
- Removed brittle allowlists entirely and switched gating to ABI-driven function classification:
  - `useContractInteraction` and `ContractService` now use helpers in `webapp/src/lib/abiInference.ts` to infer read/write from `stateMutability` (no hard-coded names).
- Confirmed no UI references to `tokenOfOwnerByIndex` remain.
- Confirmed Admin UI does not expose `updateBasePrice` (function is private on contract; AppContext explicitly omits it).

Files changed (already in main):
- webapp/src/hooks/useContractInteraction.ts
- webapp/src/services/blockchain/contractService.ts
- webapp/src/lib/abiInference.ts (new)
- webapp/src/config/constants.ts (allowlists removed; constants only)

## Acceptance Criteria (Met)
- No references to `tokenOfOwnerByIndex` remain in the codebase.
- Function classification for reads/writes is derived from the ABI (no stale allowlists present).
- Admin controls do not expose a button that calls `updateBasePrice`.
- Admin actions for `setMaxPriceUpdateIterations` and `recoverSurplusUSDC` are permitted and pass classification.

## Regression Risks
- Removing items from the allowlists may hide real functions if mis‑typed; verify against `webapp/src/config/AstaVerde.json`.

## Validation
- Static checks:
  - `webapp/src/lib/abiInference.ts` correctly classifies functions in `webapp/src/config/AstaVerde.json` (view/pure vs nonpayable/payable).
- Runtime smoke (recommended):
  - `npm run dev:local` → Admin → set a temporary `Max Price Update Iterations` value and verify tx simulates and sends.
  - `Recover Surplus USDC` triggers simulation (will revert if no surplus), classification allows the call.

## References
- Contract ABI: `webapp/src/config/AstaVerde.json`
- Code sites: `webapp/src/contexts/AppContext.tsx`, `webapp/src/hooks/useContractInteraction.ts`, `webapp/src/services/blockchain/contractService.ts`, `webapp/src/lib/abiInference.ts`

Follow-ups:
- Ticket 215 captured this refactor; confirm ticket status reflects completion.
