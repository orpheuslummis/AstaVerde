# Ticket 205: Webapp - Refactor Large Component Files

## Status
OPEN

## Priority
LOW

## Category
webapp-refactor

## Description
Several component files exceed recommended size limits, making them hard to maintain and understand.

## Current State
- `webapp/src/app/mytokens/page.tsx` - 832 lines
- `webapp/src/app/admin/page.tsx` - 583+ lines (now larger with new controls)

## Impact
- Difficult to navigate and understand
- Hard to test individual pieces
- Slower IDE performance
- Higher cognitive load
- Merge conflicts more likely

## Recommendation
Break down into smaller, focused components:

### For mytokens/page.tsx:
- Extract token grouping logic to custom hook
- Move vault operations to separate component
- Extract metadata fetching to service/hook
- Separate tab content into individual components

### For admin/page.tsx:
- Each control is already a separate component (good!)
- Consider moving control components to admin/components/
- Extract common control container patterns

## Target Size
Aim for <300 lines per component file

## Benefits After Refactoring
- Easier testing (unit test individual components)
- Better reusability
- Clearer separation of concerns
- Improved performance (potential for code splitting)

## Note
This is lower priority as the code works correctly. Consider refactoring when:
- Adding new features to these pages
- Fixing bugs in these areas
- As part of general maintenance