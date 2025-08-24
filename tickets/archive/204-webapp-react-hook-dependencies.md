# Ticket 204: Webapp - Fix React Hook Dependencies

## Status

RESOLVED

## Priority

MEDIUM

## Category

webapp-quality

## Description

Multiple React Hook dependency warnings in useCallback and useEffect hooks.

## Impact

- Potential stale closures
- Unexpected behavior when dependencies change
- ESLint warnings
- Could cause bugs with state updates

## Locations Fixed (2025-01-24)

- ✅ `webapp/src/app/mytokens/RedeemTokensButton.tsx` (line 75) - Added 'redeemStatus'
- ✅ `webapp/src/app/mytokens/page.tsx` (line 284) - Added 'depositBatch' and 'vaultVersion'
- ✅ `webapp/src/components/VaultCard.tsx` (line 82) - Added 'effectiveAssetAddress'
- ✅ `webapp/src/hooks/useVault.ts` (line 257) - Added 'approveNFT'
- ✅ `webapp/src/hooks/useVault.ts` (line 314) - Added 'approveSCC' and 'publicClient'
- ✅ `webapp/src/hooks/useVault.ts` (line 360) - Added 'approveNFT'
- ✅ `webapp/src/hooks/useVault.ts` (line 423) - Added 'approveSCC'
- ✅ `webapp/src/hooks/useVault.ts` (line 480) - Added 'approveSCC' and 'publicClient'

## Remaining Non-Critical Issues

4 warnings about unnecessary dependencies (won't cause bugs, only extra re-renders):

- `webapp/src/components/VaultCard.tsx` (lines 169, 227) - Unnecessary 'onActionComplete'
- `webapp/src/hooks/useContractInteraction.ts` (line 150) - Unnecessary 'wagmiConfig'
- `webapp/src/hooks/useVault.ts` (line 113) - Unnecessary 'vaultVersion'

## Example Fix

```typescript
// Before
const handleAction = useCallback(() => {
    doSomething(value);
}, []); // Missing 'value' dependency

// After
const handleAction = useCallback(() => {
    doSomething(value);
}, [value]); // Correct dependencies
```

## Recommendation

1. Add missing dependencies to hooks
2. If intentionally omitting, use eslint-disable-next-line with explanation
3. Consider using `useMemo` for expensive computations
4. Review if some callbacks can be moved outside components

## Resolution Summary

All critical missing dependencies that could cause stale closure bugs have been fixed. The changes ensure that:

- Callbacks always have access to the latest values
- No stale closures can occur
- State updates are properly reflected in callbacks

## Testing Results

- ✅ No infinite re-render loops introduced
- ✅ All callbacks properly updated with correct dependencies
- ✅ Reduced from 12 to 4 React Hook warnings (remaining are non-critical)
- ✅ All remaining warnings are about unnecessary dependencies, not missing ones
