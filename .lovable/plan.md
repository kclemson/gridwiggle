
# Fix Hero Toggle Failures and Upload Race Condition

## Problem Summary

Three related issues with collage generation:

1. **First hero click always fails** - but clicking "Try Again" works
2. **"Try Again" has a noticeable delay** - this is expected behavior (regeneration), not a bug
3. **Errors during photo uploads** - collage tries to use photos that aren't ready yet

---

## Root Cause Analysis

### Issue #1 & #2: Hero Toggle Failure

When clicking the hero star, `handleToggleHero` calls `regenerateCollage` **without** `randomize: true`.

The V3 algorithm behaves differently based on `randomize`:
- `randomize: false`: Sorts photos by aspect ratio, picks deterministic "best" split
- `randomize: true`: Shuffles photos, picks from any valid split

For certain photo combinations (especially when adding a hero), the deterministic path fails to find a valid configuration. The randomized path explores more options and succeeds.

**Why "Try Again" works**: The retry button explicitly passes `randomize: true` which shuffles and finds a valid layout.

### Issue #3: Upload Race Condition

Photos are created with `originalWidth: 0, originalHeight: 0` before dimensions are loaded. If collage regeneration is triggered while photos are still processing, the algorithm receives photos with `aspectRatio = 0/0 = NaN`, causing failures.

---

## Technical Changes

### 1. File: `src/pages/Index.tsx`

**Change A: Add randomize to hero toggle** (around line 276)

```tsx
// Before:
if (state.layout) {
  regenerateCollage({ 
    priorityOverride: { photoId, priority: newPriority },
    settings: newPriority === 1 ? { ...state.settings, shape: 'auto' } : undefined,
  });
}

// After:
if (state.layout) {
  regenerateCollage({ 
    priorityOverride: { photoId, priority: newPriority },
    settings: newPriority === 1 ? { ...state.settings, shape: 'auto' } : undefined,
    randomize: true,  // Shuffle for variety - avoids deterministic failures
  });
}
```

**Change B: Filter out unready photos in regenerateCollage** (around line 101)

Add a filter to exclude photos with missing dimensions before generating the layout:

```tsx
// After line 108, before "Need at least 2 photos":
// Filter out photos that aren't ready (missing dimensions)
photosToUse = photosToUse.filter(p => 
  p.originalWidth > 0 && p.originalHeight > 0
);
```

This ensures the layout algorithm only receives valid photos with known dimensions.

---

## Why These Fixes Work

| Issue | Fix | Rationale |
|-------|-----|-----------|
| First hero click fails | Add `randomize: true` | Explores more layout options, avoids deterministic dead-ends |
| Error during uploads | Filter unready photos | Prevents NaN aspect ratios from breaking the algorithm |

---

## User Experience After Fix

1. **Hero toggle**: Works on first click reliably
2. **Photo uploads**: Collage uses only ready photos, updates as more become available
3. **No more "Try Again" for normal operations** - layout generation is more robust

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `randomize: true` to hero toggle; Filter unready photos before layout generation |
