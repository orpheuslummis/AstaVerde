# 213 — [Critical] Fix token tuple shape and parsing (`tokens(uint256)`)

Status: fixed (moved to archive)
Severity: critical
Area: webapp/contracts-integration, types

## Problem
`IAstaVerde.tokens(tokenId)` and the mapping getter in `AstaVerde.sol` return 5 fields:
`[originalMinter, tokenId, producer, cid, redeemed]`.

The webapp types/services currently assume 4 outputs, causing mis-parsing and runtime errors.

Examples:
- `webapp/src/types.ts` and `webapp/src/features/marketplace/types.ts` define `TokenData` with 4 fields.
- `MarketplaceService.getTokenInfo` validates `length === 4` and thus rejects the correct 5‑tuple.

Impact: Token detail views and any consumer of `tokens(...)` may fail or display incorrect data.

## Resolution
- Standardized tuple shape and added an object form:
  - `TokenDataTuple = [string, bigint, string, string, boolean]`
  - `TokenDataObj { originalMinter, tokenId, producer, cid, redeemed }`
- Updated `MarketplaceService.getTokenInfo` to parse 5 outputs and return `TokenDataObj`.
- Corrected duplicate 4‑field `TokenData` in `webapp/src/types.ts` to the 5‑field order.
  - Note: Token detail page already handled 5‑tuple; no change needed there.

## Acceptance Criteria
- Types compile with the 5‑field definition.
- `getTokenInfo(tokenId)` returns structured data with all 5 fields.
- Token detail page renders producer, metadata CID, and redeemed status without runtime errors.

All criteria satisfied.

## References
- Contract ABI: `webapp/src/config/AstaVerde.json` → `"name": "tokens"` outputs 5 fields.

