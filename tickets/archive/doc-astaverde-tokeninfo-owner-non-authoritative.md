# Ticket: Document `TokenInfo.owner` as Non-Authoritative (Avoid Consumer Misuse)

- Component: `contracts/AstaVerde.sol`, `contracts/IAstaVerde.sol`
- Severity: Medium (Integration Risk)
- Type: Documentation/API Hygiene

## Background / Justification

`TokenInfo.owner` is set at mint and not updated on transfers. External consumers may assume it reflects the current owner, leading to incorrect authorization or UI displays. Vault integration (Phase 2) correctly relies on ERC1155 balances and `redeemed`, not `owner`.

## Impact

- Risk of integrators (or future code) using a stale `owner` field for auth or UI, causing logic bugs and user confusion.

## Tasks

1. Add explicit NatSpec comments to `AstaVerde.tokens` and `IAstaVerde` stating that `owner` is not authoritative and should not be used for authorization.
2. Update README/docs to direct integrators to rely on ERC1155 `balanceOf` for ownership checks.
3. (Optional) Add a helper example in docs: how to verify current owner via `balanceOf(user, tokenId) > 0`.

## Acceptance Criteria

- Clear, prominent documentation warns against using `TokenInfo.owner` for auth.
- No code paths in Phase 2 rely on this value (verify quickly across contracts/tests).

## Affected Files

- `contracts/IAstaVerde.sol`
- `contracts/AstaVerde.sol` (NatSpec comments only)
- `README.md` (integration notes)
