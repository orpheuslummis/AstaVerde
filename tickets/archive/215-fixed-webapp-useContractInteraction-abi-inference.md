# 215 — [High] Make `useContractInteraction` infer read/write from ABI (reduce brittle allowlists)

Status: fixed
Severity: high
Area: webapp/devex

## Problem
`useContractInteraction` relies on hard‑coded `READ_ONLY_FUNCTIONS` and `WRITE_FUNCTIONS` names in `webapp/src/config/constants.ts` to decide how to call a function. This is brittle:

- Typos or contract evolution produce "Unknown function" errors.
- Stale lists trigger background read failures (see Ticket 212).

## Proposed Fix (either)
Option A — ABI‑driven inference
- Inspect the ABI entry for `functionName` from `contractConfig.abi`.
- If `stateMutability` is `view`/`pure`, call via `publicClient.readContract`.
- Otherwise, simulate and then write via `walletClient`/`useWriteContract`.

Option B — Explicit intent at call sites
- Extend hook signature: `useContractInteraction(config, functionName, { kind: 'read' | 'write' })`.
- Deprecate the allowlists and migrate call sites.

Short‑term mitigation
- If full refactor is deferred, at least sync allowlists to current ABIs and keep them minimal.

## Acceptance Criteria
- `useContractInteraction` no longer depends on static allowlists for core flows.
- Adding a new read function (present in ABI) requires no constants changes.
- Background read errors due to stale allowlists are eliminated.

## Validation
- Smoke test core reads/writes (marketplace admin setters, `getBatchInfo`, `buyBatch`, vault deposit/withdraw) on local stack.
- Add a small unit test: mock ABI with a `view` function and a `nonpayable` function; assert the hook selects correct code path.

## Resolution (2025-08-27)

Implemented ABI-driven inference and removed brittle allowlists.

- Added ABI helpers: `webapp/src/lib/abiInference.ts`
  - `getFunctionKind(abi, name)` → `read` | `write` | `unknown`
  - `isReadFunctionByAbi`, `isWriteFunctionByAbi`
- Refactored hook: `webapp/src/hooks/useContractInteraction.ts`
  - Use ABI inference to branch read/write; clearer error for missing ABI entries.
- Refactored service: `webapp/src/services/blockchain/contractService.ts`
  - Enforce read/write via ABI classification.
- Removed allowlists: `webapp/src/config/constants.ts`
  - Deleted READ_ONLY_FUNCTIONS and WRITE_FUNCTIONS; added deprecation comment.

Validation performed:
- Static scan confirms no remaining references to allowlists.
- Local smoke recommended next run of `npm run dev:local` to exercise reads/writes; hook now treats new ABI functions without constants updates.

Notes:
- Optional unit tests were not added in this pass (no test runner configured in webapp). Consider adding a minimal test harness in a follow-up.

