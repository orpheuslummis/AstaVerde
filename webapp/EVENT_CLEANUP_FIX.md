# Event Listener Cleanup Fix

## Issue #036: Memory Leak Prevention

### Problem
Custom event listeners for `astaverde:refetch` were being added but potentially not cleaned up properly, which could cause memory leaks in long-running sessions.

### Solution Implemented

1. **Created `useGlobalEvent` Hook** (`src/hooks/useGlobalEvent.ts`)
   - Generic hook for managing window event listeners with automatic cleanup
   - Ensures listeners are removed when components unmount
   - Provides type-safe event handling

2. **Created `useAstaVerdeRefetch` Hook**
   - Specialized hook for the `astaverde:refetch` event
   - Simplifies usage in components

3. **Added `dispatchRefetch` Helper Function**
   - Centralized function for dispatching the refetch event
   - Consistent implementation across the app

### Components Updated

1. **AppContext.tsx**
   - Now uses `useAstaVerdeRefetch` hook instead of manual addEventListener/removeEventListener
   - Cleaner, more maintainable code

2. **VaultCard.tsx**
   - Uses `dispatchRefetch()` helper instead of inline event dispatch
   - Consistent with app-wide pattern

3. **BatchCard.tsx**
   - Uses `dispatchRefetch()` helper instead of inline event dispatch
   - Consistent with app-wide pattern

### Benefits

✅ **Memory Leak Prevention**: Guaranteed cleanup on component unmount
✅ **Reusable Pattern**: Can be used for other global events
✅ **Type Safety**: Full TypeScript support
✅ **Cleaner Code**: Less boilerplate, more maintainable
✅ **Consistent API**: Same pattern across all components

### Usage Examples

```typescript
// Using the generic hook
import { useGlobalEvent } from '@/hooks/useGlobalEvent';

useGlobalEvent('custom:event', (event) => {
  console.log('Event received:', event);
}, []);

// Using the specialized refetch hook
import { useAstaVerdeRefetch } from '@/hooks/useGlobalEvent';

useAstaVerdeRefetch(() => {
  // Handle refetch
  refetchData();
}, [refetchData]);

// Dispatching the event
import { dispatchRefetch } from '@/hooks/useGlobalEvent';

const handleSuccess = () => {
  // ... success logic
  dispatchRefetch(); // Notify other components
};
```

### Testing

A test script is provided at `webapp/test-event-cleanup.js` that can be run in the browser console to verify:
1. Event dispatch works correctly
2. Event listeners are properly removed
3. No memory leaks occur

### Future Improvements

- Consider implementing an event bus pattern if more complex event handling is needed
- Add performance monitoring for event handling
- Consider using React Context for state updates instead of events where appropriate