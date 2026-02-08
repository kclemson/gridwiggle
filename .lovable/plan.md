

# AR-Stratified Sampling + Fix Rejection Preview in App UI

## Summary

Two changes:
1. **AR-Stratified Sampling**: Distribute photos to BESIDE/BELOW regions by proportional sampling from AR buckets (Portrait/Square/Landscape) instead of sequential slicing
2. **Fix Rejection Preview**: The app UI's debug panel doesn't show hover previews for rejections because the worker-to-main-thread log rehydration drops `rejectedLayout` and `level` fields

---

## Part 1: Fix Rejection Preview (Root Cause)

### The Bug

In `src/pages/Index.tsx`, when logs come back from the worker, they're re-added to `devLogger` like this:

```typescript
for (const log of result.logs) {
  devLogger.log(log.category, log.label, log.data);  // ← Drops level and rejectedLayout!
}
```

The `rejectedLayout` geometry is attached to each log entry by the worker, but this code only passes 3 of 5 fields. The V3Test page works because it runs layout generation on the main thread (no worker), so `devLogger.getLogs()` has the full objects.

### The Fix

**File: `src/pages/Index.tsx`** (lines 210-214)

Change the log rehydration to preserve all fields:

```typescript
if (result.logs) {
  for (const log of result.logs) {
    devLogger.log(log.category, log.label, log.data, log.level || 'info', log.rejectedLayout);
  }
}
```

This passes the full `LogEntry` including:
- `level` (for proper warn/error styling)
- `rejectedLayout` (for hover preview geometry)

---

## Part 2: AR-Stratified Sampling

### What This Solves

Currently, photos are assigned to BESIDE vs BELOW regions via sequential slicing:

```typescript
const besidePhotos = orderedPhotos.slice(0, besideCount);
const belowPhotos = orderedPhotos.slice(besideCount);
```

When photos are sorted by AR, all narrow portraits cluster in one region, creating visual imbalance (the "11 portraits beside, 2 landscapes below" problem from your screenshot).

### The Solution

Distribute photos so that both regions receive a proportional sample from each AR bucket:

| Bucket | AR Range |
|--------|----------|
| Portrait | AR < 0.8 |
| Square | 0.8 ≤ AR ≤ 1.25 |
| Landscape | AR > 1.25 |

### Implementation

**File: `src/lib/v3/utils.ts`** — Add new utility:

```typescript
// AR bucket thresholds
const AR_BUCKET_PORTRAIT = 0.8;
const AR_BUCKET_LANDSCAPE = 1.25;

type ARBucket = 'portrait' | 'square' | 'landscape';

function getARBucket(ar: number): ARBucket {
  if (ar < AR_BUCKET_PORTRAIT) return 'portrait';
  if (ar > AR_BUCKET_LANDSCAPE) return 'landscape';
  return 'square';
}

/**
 * Distribute photos to two regions using stratified sampling by AR bucket.
 * Each region receives a proportional sample from each bucket,
 * ensuring shape diversity rather than clustering.
 */
export function stratifiedARDistribution(
  photos: PhotoDimension[],
  besideCount: number,
  randomize: boolean
): [PhotoDimension[], PhotoDimension[]] {
  if (besideCount <= 0) return [[], photos];
  if (besideCount >= photos.length) return [photos, []];
  
  // Group photos by AR bucket
  const buckets: Record<ARBucket, PhotoDimension[]> = {
    portrait: [],
    square: [],
    landscape: [],
  };
  
  for (const photo of photos) {
    buckets[getARBucket(photo.aspectRatio)].push(photo);
  }
  
  // Shuffle within buckets if randomizing
  if (randomize) {
    buckets.portrait = shuffleArray(buckets.portrait);
    buckets.square = shuffleArray(buckets.square);
    buckets.landscape = shuffleArray(buckets.landscape);
  }
  
  // Proportional allocation per bucket
  const total = photos.length;
  const besideFraction = besideCount / total;
  
  const besideFromPortrait = Math.round(buckets.portrait.length * besideFraction);
  const besideFromSquare = Math.round(buckets.square.length * besideFraction);
  let besideFromLandscape = besideCount - besideFromPortrait - besideFromSquare;
  besideFromLandscape = Math.max(0, Math.min(besideFromLandscape, buckets.landscape.length));
  
  // Build arrays
  const beside: PhotoDimension[] = [
    ...buckets.portrait.slice(0, besideFromPortrait),
    ...buckets.square.slice(0, besideFromSquare),
    ...buckets.landscape.slice(0, besideFromLandscape),
  ];
  
  const below: PhotoDimension[] = [
    ...buckets.portrait.slice(besideFromPortrait),
    ...buckets.square.slice(besideFromSquare),
    ...buckets.landscape.slice(besideFromLandscape),
  ];
  
  // Handle rounding errors
  while (beside.length > besideCount && below.length < photos.length - besideCount) {
    below.push(beside.pop()!);
  }
  while (beside.length < besideCount && below.length > 0) {
    beside.push(below.shift()!);
  }
  
  // Final shuffle to mix buckets within each region
  return randomize 
    ? [shuffleArray(beside), shuffleArray(below)]
    : [beside, below];
}
```

**File: `src/lib/v3/region-search.ts`** — Use new utility:

```typescript
// Import at top
import { stratifiedARDistribution } from './utils';

// In findValidRegionAssignment, replace lines 113-115:

// BEFORE:
const besidePhotos = orderedPhotos.slice(0, besideCount);
const belowPhotos = orderedPhotos.slice(besideCount);

// AFTER:
const [besidePhotos, belowPhotos] = stratifiedARDistribution(
  orderedPhotos,
  besideCount,
  randomize
);
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Fix log rehydration to preserve `level` and `rejectedLayout` |
| `src/lib/v3/utils.ts` | Add `stratifiedARDistribution()` utility |
| `src/lib/v3/region-search.ts` | Replace sequential slicing with stratified distribution |

---

## Expected Results

### Rejection Preview Fix
- App UI debug logs will show underlined rejection entries
- Hovering will display the CSS box preview with AR labels

### AR-Stratified Sampling
- Both BESIDE and BELOW regions receive proportional mix of portrait/square/landscape photos
- Reduces "all portraits beside" clustering that causes prominence failures
- Layout success rate should improve for portrait-heavy photo sets

