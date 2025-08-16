# Ticket #036: Webapp Event Listener Memory Leak

## Status: COMPLETED
**Priority**: MEDIUM  
**Type**: Bug/Memory Leak  
**Component**: Webapp (Event Handling)  
**Created**: 2025-01-16  
**Completed**: 2025-01-16  

## Problem

Custom event listeners for `astaverde:refetch` are added but never removed, potentially causing memory leaks in long-running sessions. Components dispatch this event but don't clean up listeners.

### Current Implementation
```typescript
// Event is dispatched in multiple places:
// webapp/src/components/VaultCard.tsx:123
window.dispatchEvent(new Event('astaverde:refetch'));

// webapp/src/components/BatchCard.tsx:63
window.dispatchEvent(new Event('astaverde:refetch'));
```

### Missing Cleanup
No components appear to:
1. Add listeners for this event with cleanup
2. Remove listeners on unmount
3. Use weak references

### Potential Impact
- Memory leaks in long sessions
- Duplicate event handlers after component remounts
- Degraded performance over time
- Possible stale closure issues

## Solution

### Add Proper Event Listener Management
```typescript
// Example of proper cleanup pattern
useEffect(() => {
    const handleRefetch = () => {
        // Handle refetch logic
        fetchTokens();
    };
    
    window.addEventListener('astaverde:refetch', handleRefetch);
    
    // Cleanup function
    return () => {
        window.removeEventListener('astaverde:refetch', handleRefetch);
    };
}, [fetchTokens]);
```

### Create Custom Hook for Event Management
```typescript
// webapp/src/hooks/useGlobalEvent.ts
export function useGlobalEvent(
    eventName: string,
    handler: EventListener,
    deps: DependencyList = []
) {
    useEffect(() => {
        window.addEventListener(eventName, handler);
        return () => {
            window.removeEventListener(eventName, handler);
        };
    }, deps);
}

// Usage:
useGlobalEvent('astaverde:refetch', handleRefetch, [handleRefetch]);
```

### Alternative: Use Event Bus Pattern
```typescript
// webapp/src/utils/eventBus.ts
class EventBus {
    private listeners = new Map<string, Set<Function>>();
    
    on(event: string, callback: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);
        
        // Return cleanup function
        return () => this.off(event, callback);
    }
    
    off(event: string, callback: Function) {
        this.listeners.get(event)?.delete(callback);
    }
    
    emit(event: string, ...args: any[]) {
        this.listeners.get(event)?.forEach(cb => cb(...args));
    }
}

export const eventBus = new EventBus();
```

## Implementation Checklist

1. **Audit Current Usage**
   - [ ] Find all `window.dispatchEvent` calls
   - [ ] Find all event listeners (if any)
   - [ ] Identify components that need cleanup

2. **Add Cleanup to Existing Listeners**
   - [ ] Add removeEventListener in cleanup functions
   - [ ] Use dependency arrays correctly

3. **Create Reusable Hook**
   - [ ] Implement useGlobalEvent hook
   - [ ] Add TypeScript types
   - [ ] Document usage

4. **Update Components**
   - [ ] Replace direct addEventListener with hook
   - [ ] Test cleanup on unmount
   - [ ] Verify no duplicate handlers

## Testing Requirements

1. **Memory Leak Testing**
   ```typescript
   // Test that listeners are removed
   const listeners = (window as any).getEventListeners?.(window);
   expect(listeners?.['astaverde:refetch']?.length).toBe(0);
   ```

2. **Component Lifecycle Testing**
   - Mount/unmount components repeatedly
   - Verify no accumulation of listeners
   - Check memory usage doesn't increase

3. **Functional Testing**
   - Verify events still trigger correctly
   - Ensure cleanup doesn't break functionality
   - Test with multiple listeners

## Affected Components

Based on event dispatch locations:
- `webapp/src/components/VaultCard.tsx`
- `webapp/src/components/BatchCard.tsx`
- Any component listening for 'astaverde:refetch'
- Parent components that might add listeners

## Memory Leak Detection

```javascript
// Chrome DevTools snippet to check listeners
getEventListeners(window).hasOwnProperty('astaverde:refetch');

// Check listener count
getEventListeners(window)['astaverde:refetch']?.length;
```

## Acceptance Criteria

- [x] All event listeners have corresponding cleanup
- [x] No memory leaks after extended use
- [x] Custom hook created for reusable pattern
- [x] Documentation updated with best practices
- [x] No duplicate event handlers

## Resolution

**Completed on**: 2025-01-16

### Implementation Summary

1. **Created `useGlobalEvent` Hook** (`webapp/src/hooks/useGlobalEvent.ts`)
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

- **AppContext.tsx**: Now uses `useAstaVerdeRefetch` hook instead of manual addEventListener/removeEventListener
- **VaultCard.tsx**: Uses `dispatchRefetch()` helper instead of inline event dispatch
- **BatchCard.tsx**: Uses `dispatchRefetch()` helper instead of inline event dispatch

### Benefits Achieved

- ✅ Memory leak prevention with guaranteed cleanup on component unmount
- ✅ Reusable pattern for other global events
- ✅ Full TypeScript support
- ✅ Cleaner, more maintainable code
- ✅ Consistent API across all components

### Files Changed
- Created: `webapp/src/hooks/useGlobalEvent.ts`
- Updated: `webapp/src/contexts/AppContext.tsx`
- Updated: `webapp/src/components/VaultCard.tsx`
- Updated: `webapp/src/components/BatchCard.tsx`
- Created: `webapp/EVENT_CLEANUP_FIX.md` (documentation)
- Created: `webapp/test-event-cleanup.js` (test script)

## Priority Justification

Medium priority because:
- Affects long-running sessions
- Can degrade performance
- Best practice for React applications
- Prevents potential bugs from stale closures

## Related Issues
- General cleanup and code quality improvements
- Performance optimization for heavy users