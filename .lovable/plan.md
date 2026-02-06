

# Fix: Expand Split Search to Include "No BESIDE" and Higher BESIDE Counts

## Summary

The split search only explores configurations with 1-6 photos BESIDE the hero, always leaving at least 1 for BELOW. This prevents the algorithm from finding valid configurations like "hero at top, full width, all content below" (portrait layouts) or "hero with many photos beside" (for very wide heroes with many photos).

The canvas AR constraint already works in normalized space to prevent "starving" one region—we just need to let the search explore more configurations.

---

## Design Intent

**What problem are we solving?**  
The search space is artificially limited. With 6 photos, we can't generate "hero at top, 6 photos in 2 rows below" even though it's geometrically valid. With 30 photos, we can't try putting more than 6 beside the hero even if the geometry supports it.

**What will users experience?**  
- More valid hero layouts, especially for portrait/square canvases
- The algorithm will find the best configuration across a wider range of options
- Low photo counts can produce "hero at top" layouts naturally

---

## The Constraint System (All in Normalized Space)

Canvas AR is the constraint that prevents bad splits:

```text
canvasAR = heroRowWidth / totalHeight
         = (heroAR + gap + besideWidth) / (1 + gap + belowHeight)
```

For a split to be valid:
- `canvasAR >= canvas_minAR` (prevents too tall/portrait)
- `canvasAR <= canvas_maxAR` (prevents too wide/landscape)

### Example: 30 photos, heroAR = 1.5

**Bad split: 29 beside, 1 below**
- besideWidth ≈ 29 × 0.5 = 14.5 (if narrow photos in multiple rows)
- heroRowWidth = 1.5 + 0.02 + 14.5 = 16.02
- belowHeight ≈ 0.2 (single wide photo)
- canvasAR = 16.02 / 1.22 ≈ 13.1 → **exceeds maxAR 2.0 → REJECTED**

**Valid split: 5 beside, 24 below**
- besideWidth ≈ 2.0
- heroRowWidth = 3.52
- belowHeight ≈ 2.8 (24 photos in ~4 rows)
- canvasAR = 3.52 / 3.82 ≈ 0.92 → **within bounds → VALID**

The math works! We just need to let the search try more options.

---

## File Changes

### 1. `src/lib/v3/split-search.ts` — Expand search space

**Change 1: Allow "no BESIDE" configuration (besideCount = 0)**

```typescript
// Line 58-59: Change from
const maxBesidePhotos = Math.min(photos.length - 1, 6);
const minBesidePhotos = 1;

// To:
const minBesidePhotos = 0;  // Allow "hero at top, all below"
const maxBesidePhotos = Math.min(photos.length, 8);  // Allow more beside, up to all photos
```

**Change 2: Handle besideCount = 0 case**

When `besideCount = 0`:
- Skip the BESIDE packing (no BESIDE region)
- heroRowWidth = heroAR (just the hero)
- All photos go to BELOW

```typescript
// After line 70 (taking photos for regions)
if (besideCount === 0) {
  // No BESIDE region - hero takes full width of row
  const belowPhotos = photos;
  const heroRowWidth = heroAR;
  
  // Calculate BELOW row count
  const belowRowCount = calculateBelowRowCount(
    belowPhotos, heroRowWidth, normalizedGap,
    tuning.canvas_minAR, tuning.canvas_maxAR
  );
  
  // Pack BELOW
  const belowResult = packToFillWidth(belowPhotos, heroRowWidth, normalizedGap, belowRowCount);
  
  // Validate canvas AR
  const totalHeight = 1.0 + normalizedGap + belowResult.height;
  const canvasAR = heroRowWidth / totalHeight;
  
  if (canvasAR >= tuning.canvas_minAR && canvasAR <= tuning.canvas_maxAR) {
    const score = scoreSplit(heroAR, { cells: [], width: 0, height: 1 }, belowResult, normalizedGap, tuning);
    if (!bestSplit || score > bestSplit.score) {
      bestSplit = {
        besidePhotos: [],
        belowPhotos,
        besideRowCount: 0,
        belowRowCount,
        score,
      };
    }
  }
  continue; // Move to next besideCount
}
```

**Change 3: Remove artificial maxBesidePhotos cap of 6**

The cap of 6 was from pixel-based thinking. In normalized space, the canvas AR constraint naturally limits how many can go beside—if there are too many, the canvas becomes too wide and is rejected.

```typescript
// Calculate based on what could possibly fit in AR bounds
// If we have 30 photos and heroAR = 1.5, maxAR = 2.0:
// Even with lots beside, the AR constraint will reject invalid configs
const maxBesidePhotos = Math.min(photos.length, 12); // Reasonable upper bound to limit search time
```

### 2. `src/lib/v3/intersection.ts` — Handle "no BESIDE" in evaluation

Update `evaluateNormalizedProposal` to handle splits where `besidePhotos.length === 0`:

```typescript
// After line 159 (Pack BESIDE section)
if (splitResult.besidePhotos.length === 0) {
  // No BESIDE region - hero takes full width
  const heroRowWidth = heroAR;
  
  // Pack BELOW
  const belowResult = packToFillWidth(
    splitResult.belowPhotos,
    heroRowWidth,
    estimatedNormalizedGap,
    splitResult.belowRowCount
  );
  
  // Continue with the rest of the evaluation using heroRowWidth and belowResult
  // ... (rest of the function uses these values)
} else {
  // Original flow with BESIDE packing
  // ...
}
```

### 3. `src/lib/v3/split-search.ts` — Remove `maxPhotosPerRow` parameter

Since we're deriving canvas width from geometry (bottom-up), the pixel-based `maxPhotosPerRow` constraint is no longer needed. Canvas AR is the real constraint.

```typescript
export function findBestSplit(
  photos: PhotoDimension[],
  heroAR: number,
  normalizedGap: number,
  tuning: V3Tuning
  // Remove: maxPhotosPerRow parameter
): SplitResult | null {
```

And remove the density checks that use `maxPhotosPerRow` (lines 79-89, 108-118).

### 4. `src/lib/v3/intersection.ts` — Remove `maxPhotosPerRow` calculation

```typescript
// Remove lines 126-127:
// const maxPhotosPerRow = Math.floor(canvasWidth / tuning.region_minWidth);

// Update findBestSplit call to remove the parameter
const splitResult = findBestSplit(
  contentPhotos,
  heroAR,
  estimatedNormalizedGap,
  tuning
);
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/split-search.ts` | Allow besideCount = 0, increase maxBesidePhotos, remove maxPhotosPerRow checks |
| `src/lib/v3/intersection.ts` | Handle "no BESIDE" in evaluation, remove maxPhotosPerRow |

---

## How Canvas AR Prevents "Starvation"

The beauty of the normalized approach is that canvas AR is the single constraint that balances the distribution:

**Too many BESIDE (wide canvas)**
```text
heroRowWidth grows → canvasAR increases → exceeds maxAR → REJECTED
```

**Too many BELOW (tall canvas)**
```text
belowHeight grows → canvasAR decreases → drops below minAR → REJECTED
```

**Balanced split (valid canvas)**
```text
heroRowWidth and totalHeight in proportion → canvasAR in [0.67, 2.0] → VALID
```

This means we don't need separate "max photos per row" or "min photos in region" rules. The geometry itself enforces balanced distributions through the AR bounds.

---

## Result

**Before**: Search only tries besideCount = 1 to 6, always fails for many configurations

**After**: Search tries besideCount = 0 to 12 (or all photos), finds configurations that satisfy canvas AR bounds naturally

Low photo count (6 photos):
- besideCount = 0 → hero at top, 6 below in 2 rows → canvasAR ≈ 0.8 → **VALID**
- besideCount = 5 → hero + 5 beside, 1 below → canvasAR ≈ 2.5 → **REJECTED** (too wide)
- besideCount = 3 → hero + 3 beside, 3 below → canvasAR ≈ 1.2 → **VALID**

The algorithm naturally finds the configurations that work!

