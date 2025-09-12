# Ticket: Add EIP-2612 Permit to SCC for UX

- Component: `contracts/StabilizedCarbonCoin.sol`
- Severity: Low (UX/Feature)
- Type: Feature
- **Status:** ❌ WONT_DO - Deprioritized
- **Decision:** 2025-01-13 - Will not implement. Nice-to-have feature, not essential for launch.

## Background / Justification

Previous design used `burnFrom` for withdraw flows, which depends on ERC20 allowances. Current design uses `transferFrom` → `burn`, still relying on allowances but without `burnFrom`. Supporting EIP-2612 permit could still reduce friction (no prior approve tx) and improve UX in wallets/dapps.

## Tasks

1. Migrate SCC to inherit from OZ’s `ERC20Permit` (or equivalent) and wire its constructor (name).
2. Ensure domain separator is correct and chain-id safe.
3. Expose `permit` to allow signatures to set allowance; maintain existing role gating and MAX_SUPPLY checks.
4. Add tests for `permit` (signature happy path, invalid sig, replay prevention).

## Acceptance Criteria

- `permit` works to set allowance for `burnFrom` without a separate approval transaction.
- Existing SCC mint/burn logic and cap remain unchanged.

## Affected Files

- `contracts/StabilizedCarbonCoin.sol`
- `test/StabilizedCarbonCoin.ts`
