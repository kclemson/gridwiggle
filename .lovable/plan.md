
# Fix: Flush Pending State on Unmount (Navigation State Loss Bug)

## Problem

When navigating between pages (e.g., from `/` to `/v3-test` and back), the collage layout disappears. This happens because:

1. State updates use a **300ms debounced save** to localStorage
2. When the component unmounts (navigation), the **cleanup effect cancels the pending save**
3. The layout never gets persisted
4. On return navigation, localStorage has stale data (missing the latest layout)

## User Impact

- Navigate to `/v3-test`, come back → collage is gone
- Any state change made within 300ms before navigation is lost
- Forces users to regenerate layouts unnecessarily

## Solution

Change the unmount behavior from **cancel** to **flush** - immediately persist any pending changes instead of discarding them.

## Technical Changes

### `src/hooks/useCollageState.ts`

**Current (problematic):**
```typescript
// Cleanup debounce timer on unmount
useEffect(() => {
  return () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);  // ← Discards pending save!
    }
  };
}, []);
```

**Fixed:**
```typescript
// Track pending state for flush-on-unmount
const pendingStateRef = useRef<CollageState | null>(null);

// Debounced save function - batches rapid state updates
const debouncedSaveMetadata = useMemo(() => {
  return (stateToSave: CollageState) => {
    // Track pending state for flush on unmount
    pendingStateRef.current = stateToSave;
    
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveMetadataToStorage(stateToSave);
      pendingStateRef.current = null;  // Clear after save
      saveTimerRef.current = null;
    }, SAVE_DEBOUNCE_MS);
  };
}, []);

// FLUSH pending save on unmount (don't discard!)
useEffect(() => {
  return () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    // Flush any pending state immediately
    if (pendingStateRef.current) {
      saveMetadataToStorage(pendingStateRef.current);
    }
  };
}, []);
```

## Why This Works

1. We track the "pending" state in a ref alongside the debounce timer
2. On normal operation, saves still batch to reduce localStorage writes
3. On unmount (navigation), instead of discarding, we **immediately save** the pending state
4. When the user returns, the state is properly restored from localStorage

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useCollageState.ts` | Add `pendingStateRef`, update debounce to track pending state, flush on unmount |

## Testing

1. Load photos and generate a collage on `/`
2. Navigate to `/v3-test`
3. Navigate back to `/`
4. **Expected**: Collage should still be visible (same as before navigation)
