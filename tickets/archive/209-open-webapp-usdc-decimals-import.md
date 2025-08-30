# Ticket 206: Webapp - Fix USDC_DECIMALS Import Consistency

## Resolution Date

2025-01-24

## Status

RESOLVED

## Priority

MEDIUM

## Category

webapp-quality

## Description

USDC_DECIMALS is defined locally in some files instead of being imported from the centralized ENV configuration.

## ~~Current Issue~~ RESOLVED

~~In `webapp/src/app/producer/page.tsx`:~~

```typescript
// FIXED: Now imports from ENV
import { ENV } from "@/config/environment";
// Uses ENV.USDC_DECIMALS throughout
```

## Resolution

- Added ENV import to producer/page.tsx
- Removed local USDC_DECIMALS constant (line 12)
- Updated all 3 references to use ENV.USDC_DECIMALS (lines 118-120)
- Verified TypeScript compilation and linting pass

## Files Modified

- `webapp/src/app/producer/page.tsx`
    - Added: `import { ENV } from '@/config/environment';`
    - Removed: `const USDC_DECIMALS = 6;`
    - Changed: All `USDC_DECIMALS` to `ENV.USDC_DECIMALS`

## Verification Steps Completed

1. ✅ Searched for all USDC_DECIMALS definitions - only producer/page.tsx had local definition
2. ✅ Verified ENV.USDC_DECIMALS exists in config/environment.ts
3. ✅ Confirmed all other files properly import from ENV
4. ✅ TypeScript compilation successful (npx tsc --noEmit)
5. ✅ Linter check passed (npm run lint)

## Benefits Achieved

- Maintains single source of truth for USDC decimals configuration
- Consistent with all other files in the codebase
- Follows DRY (Don't Repeat Yourself) principle
- Easier maintenance if decimal value needs to change

## Impact

- Potential inconsistency if decimal value changes
- Violates DRY principle
- Harder to maintain

## Files Affected

- `webapp/src/app/producer/page.tsx` (lines using USDC_DECIMALS)
- Potentially other files with local USDC_DECIMALS definitions

## Recommendation

1. Search for all local USDC_DECIMALS definitions
2. Replace with ENV.USDC_DECIMALS import
3. Ensure ENV is properly exported from config/environment.ts

## Verification

```bash
# Find all USDC_DECIMALS definitions
grep -r "const USDC_DECIMALS" webapp/src

# Find all USDC_DECIMALS usage
grep -r "USDC_DECIMALS" webapp/src --include="*.ts" --include="*.tsx"
```

## Note

ENV.USDC_DECIMALS is already defined in config/environment.ts as:

```typescript
USDC_DECIMALS: Number(process.env.NEXT_PUBLIC_USDC_DECIMALS) || 6;
```
