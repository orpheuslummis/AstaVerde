# Ticket: Add EIP-2612 Permit to SCC for UX

- Component: `contracts/StabilizedCarbonCoin.sol`
- Severity: Low (UX/Feature)
- Type: Feature
- **Status:** ❌ WONT_DO - Deprioritized
- **Decision:** 2025-01-13 - Will not implement. Nice-to-have feature, not essential for launch.

## Background / Justification

`withdraw` and `repayAndWithdraw` require `burnFrom`, which depends on ERC20 allowances. Supporting EIP-2612 permit reduces friction (no prior approve tx) and improves UX in wallets/dapps.

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
