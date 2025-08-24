# Ticket #108: MEDIUM - AstaVerde USDC Fee-on-Transfer Token Vulnerability

## Priority: MEDIUM

## Status: FIXED (Archived)

## Component: `contracts/AstaVerde.sol`

## Issue Type: Token Compatibility / Misconfiguration Risk

## Summary

`buyBatch()` assumed full receipt of `usdcAmount` without verifying balance deltas. If a fee-on-transfer token were configured as USDC, accounting could exceed actual USDC balance, breaking payouts or causing refunds to revert.

## Resolution

- Enforced canonical Base mainnet USDC address in constructor when `block.chainid == 8453`:
  - Require `usdcToken == 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.
- Keeps production safe assuming official USDC only. For test/local, optionally add a balance-delta check if using non-canonical tokens.

## Location

- File: `contracts/AstaVerde.sol`
- Function: `buyBatch()` (transfer at lines ~438-452)
- Constructor address check added near constructor

## Notes / Clarifications

- On inbound fee tokens, the contract credits more than it actually receives; payouts may later revert due to shortfall.
- Underpayment to recipients happens only if the token takes an outbound fee (not the case for canonical USDC).

## Follow-ups

- Optional: add balance delta verification on non-mainnet builds for safer local/test workflows.
- Optional: tests with a fee-on-transfer mock to demonstrate the safety check behavior.


