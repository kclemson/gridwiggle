
# Bug Fix: Hero Slider Reverts to 100% and Doesn't Update Collage

## Root Cause

The hero slider reflow logic depends on `normalizedLayoutRef.current` having the layout metadata. However, this ref is **only populated when a new layout is generated via the worker** (line 284-286 in Index.tsx). When the app loads from storage, the layout (including its `normalized` property) is restored from localStorage, but `normalizedLayoutRef` is never synced with it.

**The flow when it fails:**

1. App loads from storage with an existing layout (`state.layout.normalized` has data)
2. `normalizedLayoutRef.current` is `null` (never initialized from storage)
3. User drags hero slider
4. `handleHeroScaleChange` checks `normalizedLayoutRef.current?.metadata?.heroId` - it's `null`
5. Function returns early, no reflow happens
6. `handleHeroScaleCommit` resets `heroScale` to `1.0`
7. Slider reverts to 100%, collage unchanged

## The Fix

Sync `normalizedLayoutRef` with `state.layout.normalized` whenever the layout changes. This ensures the ref is populated both:
- When a new layout is generated (already working)
- When a layout is loaded from storage (currently broken)

## Implementation

### File: `src/pages/Index.tsx`

Add a `useEffect` that syncs the ref with state:

```typescript
// Sync normalizedLayoutRef with state.layout.normalized
// This ensures the ref is populated when layout is loaded from storage
useEffect(() => {
  if (state.layout?.normalized) {
    normalizedLayoutRef.current = state.layout.normalized;
  }
}, [state.layout?.normalized]);
```

This effect will run:
1. On initial load when `state.layout` is populated from storage
2. After any layout generation that sets `state.layout`

The existing code in `regenerateCollage` that sets `normalizedLayoutRef.current` can remain as a fast-path optimization (sets the ref before the next render), but the effect serves as the source-of-truth synchronization.

## Why This Works

- **Before**: The ref was only set in `regenerateCollage` after worker returns. Layouts from storage never populated the ref.
- **After**: Any layout with a `normalized` property (whether generated or loaded) will sync to the ref via the effect.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `useEffect` to sync `normalizedLayoutRef` with `state.layout.normalized` |

## Testing

1. Load app with existing collage (from storage)
2. Drag hero slider → should see live layout updates
3. Release slider → should commit at new scale, slider stays at released position
4. Refresh page → slider should work again (ref re-synced from storage)
5. Generate new layout → slider should still work (ref set by regenerateCollage)
