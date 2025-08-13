# Ticket: Enforce/Document USDC 6-Decimals Assumption

- Component: `contracts/AstaVerde.sol`, Docs
- Severity: Low-Medium (Integration Risk)
- Type: Validation/Documentation

## Background / Justification

Pricing and calculations assume a 6-decimal stablecoin (USDC). Deploying with a token that uses different decimals would produce incorrect pricing, payouts, and UI inconsistencies.

## Tasks (Option A – Runtime Check)

1. Add a minimal interface `IERC20Metadata { function decimals() external view returns (uint8); }`.
2. In `AstaVerde` constructor, attempt to read `decimals()` via the interface; if call succeeds, `require(decimals == 6)`.
3. If call reverts (non-standard token), fall back to documentation requirement.

## Tasks (Option B – Documentation Only)

1. Update `README.md` and deployment docs to explicitly require a 6-decimal stablecoin.
2. Add a deployment-time assertion in scripts to check `decimals()` and abort mismatches.

## Acceptance Criteria

- Either an on-chain require or clear docs + script guard prevent misconfiguration with non-6-decimal tokens.

## Affected Files

- `contracts/AstaVerde.sol` (if Option A)
- Deploy scripts/docs: `DEPLOYMENT.md`, `README.md`
