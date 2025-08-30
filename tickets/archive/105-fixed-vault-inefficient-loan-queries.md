# 105: Fixed - Vault Inefficient Loan Queries

## Summary

- Implemented per-user loan indexing and a global active-loans counter in `EcoStabilizer.sol`.
- Replaced scan-based view functions with index-backed getters; added `getUserLoansIndexed`.
- Removed `maxScanRange`, its event, and setter; standardized withdraw cleanup to `delete`.

## Details

- Writes: Slightly higher gas on deposit/withdraw due to index updates; withdraws get gas refunds.
- Reads: O(1) counts and O(k) user listings; no truncation.

## Verification

- Full test suite passing after updating thresholds and expectations.

## Date

- 2025-08-24
