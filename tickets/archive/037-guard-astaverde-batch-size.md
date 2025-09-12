# Ticket: Guard `maxBatchSize` With a Safe Upper Bound

- Component: `contracts/AstaVerde.sol`
- Severity: Medium (Gas/Operational Safety)
- Type: Parameter Guard

## Background / Justification

`mintBatch` and settlement logic scale with the number of tokens in a batch. Extremely large `maxBatchSize` values can lead to high gas consumption, out-of-gas risks, or poor UX. Currently `setMaxBatchSize` only checks `> 0`.

## Tasks

1. Add an upper bound require in `setMaxBatchSize` (e.g., `require(newSize <= 100 || 200)`) based on expected operational constraints.
2. Document the reason and adjust tests if they assume very large batches.
3. Optionally emit the current bound in docs/config for operators.

## Acceptance Criteria

- `setMaxBatchSize` reverts for unreasonably large values.
- Tests cover boundary values with gas estimates to justify limits.

## Affected Files

- `contracts/AstaVerde.sol`
- `test/AstaVerde.logic.behavior.ts`
