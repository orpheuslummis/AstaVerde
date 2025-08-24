# Ticket 202: Webapp - Duplicate useBatchOperations Hooks

## Status

RESOLVED

## Priority

MEDIUM

## Category

webapp-architecture

## Description

Two different implementations of batch operations exist:

1. `webapp/src/hooks/useContractInteraction.ts` (19KB - comprehensive, 230+ lines)
2. `webapp/src/features/marketplace/hooks/useBatchOperations.ts` (2.6KB - subset, ~50 lines)

## Impact

- Code duplication with different implementations
- Unclear which to use when
- Potential inconsistencies in batch handling
- Maintenance overhead

## Current State

- The hooks/ version is more comprehensive and widely used
- The features/ version appears to be a newer, slimmer implementation
- Both are currently in use in different parts of the codebase

## Recommendation

Options:

1. **Consolidate**: Merge functionality into one comprehensive hook in hooks/
2. **Differentiate**: Clearly separate concerns (e.g., one for reading, one for writing)
3. **Deprecate**: Mark one as deprecated and migrate to the other

## Technical Debt

This appears to be the result of parallel development or incomplete refactoring.

## Files Affected

- webapp/src/hooks/useContractInteraction.ts
- webapp/src/features/marketplace/hooks/useBatchOperations.ts
- Components using either hook

## Resolution (2025-08-24)

Removed the duplicate `useBatchOperations` function from `useContractInteraction.ts` (lines 260-474).
The features/marketplace version is retained as it:

- Uses a cleaner service-based architecture via MarketplaceService
- Is actively used by BatchCard component
- Provides better separation of concerns
- Has equivalent functionality with better approval logic

Changes made:

- Removed 215 lines of duplicate code from useContractInteraction.ts
- Cleaned up unused imports (formatUnits, useBalance, useMemo, ENV, useAppContext, customToast)
- Updated documentation to reflect the removal
- Build and tests pass successfully
