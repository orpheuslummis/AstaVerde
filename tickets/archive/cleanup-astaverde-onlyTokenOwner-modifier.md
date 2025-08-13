# Ticket: Remove Unused Code in `AstaVerde.sol` (Modifier, Errors, Constant)

- Component: `contracts/AstaVerde.sol`
- Severity: Low
- Type: Cleanup

## Background / Justification

- `onlyTokenOwner(uint256[] memory tokenIds)` is defined but not used. `redeemToken` already performs an ownership check, so the modifier is redundant.
- Custom errors `NotProducer`, `NotTokenOwner`, and `TokenAlreadyRedeemed` are declared but not used (the code uses `require` with messages instead).
- Constant `PRECISION_FACTOR` is declared but not used.

Keeping unused code increases maintenance overhead and potential confusion.

## Tasks

1. Remove the `onlyTokenOwner` modifier if no call sites are appropriate.
2. Remove unused custom errors or refactor `require` statements to use them consistently.
3. Remove `PRECISION_FACTOR` if not needed, or apply it where intended and justify usage.
4. Run lints/tests and update any references.

## Acceptance Criteria

- No unused modifiers, constants, or errors remain in `AstaVerde.sol`.
- Behavior remains unchanged (redeem path still checks balance and redeems correctly).

## Affected Files

- `contracts/AstaVerde.sol`
