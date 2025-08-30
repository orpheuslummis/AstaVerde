# 214 — [High] Consolidate contract config and types; remove duplicates

Status: open
Severity: high
Area: webapp/architecture

## Problem

The webapp maintains two contract‑config modules and duplicated type definitions:

- Config modules:
    - `webapp/src/lib/contracts.ts`
    - `webapp/src/config/contracts/index.ts`
- Contract types:
    - `webapp/src/shared/types/contracts.ts`
    - Duplicates in `webapp/src/types.ts`

This duplication leads to drift and inconsistent behavior depending on which module callers use.

## Proposed Fix

- Choose a single source of truth for contract configs: `webapp/src/config/contracts/index.ts`.
- Migrate all imports to the canonical module and delete `webapp/src/lib/contracts.ts`.
- Keep contract types only in `webapp/src/shared/types/contracts.ts`; remove duplicates from `webapp/src/types.ts`.
- Verify that services (`MarketplaceService`, `VaultService`, header balances, pages) all import from the canonical module.

## Tasks

1. Migrate imports in:
    - `webapp/src/hooks/useVault.ts`
    - `webapp/src/components/Header.tsx`
    - `webapp/src/app/token/[id]/page.tsx`
    - Any other reference to `src/lib/contracts.ts`.
2. Remove `webapp/src/lib/contracts.ts`.
3. Remove duplicate contract types from `webapp/src/types.ts`.

## Acceptance Criteria

- No references to `webapp/src/lib/contracts.ts` remain.
- App compiles and runs using `webapp/src/config/contracts/index.ts` exclusively.
- Single contract type definition module used across the app.

## Validation

- `npm run build` in `webapp/` passes.
- `npm run dev:local` runs the app; marketplace and vault flows work.
