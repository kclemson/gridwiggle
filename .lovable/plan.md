
# Fix: Thread `randomize` to Row Distribution

## Problem Summary
After gating randomness behind the `randomize` flag, the flag isn't being passed down to `distributeByARBudget` - the function that actually uses it to add jitter to row breaks. This means:

1. Jitter is **always disabled** (even when shuffle button is clicked)
2. Deterministic row distribution hits geometry edge cases that random jitter used to help avoid
3. Result: slider movements now consistently fail for certain photo sets

## What Users Will Experience After Fix
- **Slider adjustments**: Stable, predictable - no more random failures
- **Shuffle button**: Actually shuffles again (provides variety via jitter)
- **Edge cases**: If a photo set truly can't produce a valid layout, the error overlay appears instead of destroying the collage

## Technical Fix

### Thread `randomize` through the packing chain

**File: `src/lib/v3/normalized-pack.ts`**

Update `packToFillHeight` and `packToFillWidth` to accept and pass `randomize`:

```typescript
// Line 29-35: packToFillHeight signature
export function packToFillHeight(
  photos: PhotoDimension[],
  targetHeight: number,
  normalizedGap: number,
  rowCount: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false  // ADD THIS
): NormalizedPackResult {

// Line 62: pass randomize to distributeByARBudget
const rows = distributeByARBudget(photos, rowCount, tuning, randomize);
```

```typescript
// Line 159-165: packToFillWidth signature  
export function packToFillWidth(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  rowCount: number,
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false  // ADD THIS
): NormalizedPackResult {

// Line 191: pass randomize to distributeByARBudget
const rows = distributeByARBudget(photos, rowCount, tuning, randomize);
```

**File: `src/lib/v3/split-search.ts`**

Update calls to packing functions to pass `randomize`:

```typescript
// Line 93: packToFillWidth for BELOW in "no BESIDE" case
const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize);

// Line 138: packToFillHeight for BESIDE
const besideResult = packToFillHeight(besidePhotos, 1.0, normalizedGap, besideRowCount, tuning, randomize);

// Line 155: packToFillWidth for BELOW
const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount, tuning, randomize);
```

**File: `src/lib/v3/intersection.ts`**

Update calls in `evaluateNormalizedProposal` and `generateSimpleRowsLayout`:

```typescript
// In evaluateNormalizedProposal (~line 158):
besideResult = packToFillHeight(
  splitResult.besidePhotos,
  1.0,
  normalizedGapForLayout,
  splitResult.besideRowCount,
  tuning,
  randomize  // ADD THIS
);

// (~line 178):
const belowResult = packToFillWidth(
  splitResult.belowPhotos,
  heroRowWidth,
  normalizedGapForLayout,
  belowRowCount,
  tuning,
  randomize  // ADD THIS
);

// In generateSimpleRowsLayout (~line 506):
const normalizedResult = packToFillWidth(
  photos, 
  1.0, 
  estimatedNormalizedGap, 
  rowCount, 
  tuning,
  false  // Simple rows always deterministic
);
```

## Files Changed

| File | Change |
|------|--------|
| `src/lib/v3/normalized-pack.ts` | Add `randomize` param to `packToFillHeight` and `packToFillWidth`, pass to `distributeByARBudget` |
| `src/lib/v3/split-search.ts` | Pass `randomize` to all packing function calls |
| `src/lib/v3/intersection.ts` | Pass `randomize` to packing function calls in `evaluateNormalizedProposal` |

## Why This Fixes the Issue

1. **Slider movements**: `randomize=false` → deterministic packing → consistent (not random failure)
2. **Shuffle button**: `randomize=true` → jitter enabled → variety in row distribution → explores more configurations that might pass canvas AR constraints
3. **Edge cases still fail gracefully**: If geometry truly doesn't work, error overlay shows instead of destroying collage

## Testing Checklist
1. Upload 10+ landscape photos, generate collage
2. Move spacing slider - should remain stable
3. Click shuffle - should produce different layouts
4. Verify no random "couldn't generate" errors on slider movement
