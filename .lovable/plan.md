
# Fix Hero Not Rendering in Rejected Layouts

## Problem

When a layout is rejected, the hero photo appears as a black rectangle instead of showing the actual image. This makes it hard to evaluate whether the rejection was valid.

## Root Cause

In `buildRejectedCells()` (region-search.ts), the hero cell is created with a hardcoded `photoId: 'hero'`:

```typescript
cells.push({
  photoId: 'hero',  // BUG: Hardcoded string instead of actual photo ID
  x: borderOffset,
  y: borderOffset,
  width: heroAR,
  height: 1.0,
});
```

When `CollagePreview` tries to render this cell, it looks for a photo with `id === 'hero'`. Since no such photo exists (actual heroes have IDs like `"photo-1"`), the cell is skipped entirely, leaving a black gap.

## Solution

Pass the actual hero photo ID through the function chain so `buildRejectedCells()` can use it.

## Changes Required

### 1. Update `findValidRegionAssignment()` signature

Add `heroPhotoId: string` as a parameter (after `heroAR`):

```typescript
export function findValidRegionAssignment(
  photos: PhotoDimension[],
  heroAR: number,
  heroPhotoId: string,  // NEW: actual hero photo ID
  normalizedGap: number,
  tuning: V3Tuning,
  randomize: boolean = false
): RegionSearchResult {
```

### 2. Update all `buildRejectedCells()` calls

Pass `heroPhotoId` to each call (4 locations in the function).

### 3. Update `buildRejectedCells()` signature and implementation

```typescript
function buildRejectedCells(
  heroAR: number,
  heroPhotoId: string,  // NEW
  besideResult: { ... } | null,
  belowResult: { ... },
  normalizedGap: number
): LayoutCell[] {
  // ...
  cells.push({
    photoId: heroPhotoId,  // Use actual ID instead of 'hero'
    x: borderOffset,
    y: borderOffset,
    width: heroAR,
    height: 1.0,
  });
  // ...
}
```

### 4. Update call site in `intersection.ts`

Pass `heroPhoto.id` when calling `findValidRegionAssignment()`:

```typescript
const regionResult = findValidRegionAssignment(
  contentPhotos,
  heroAR,
  heroPhoto.id,  // NEW
  normalizedGap,
  tuning,
  randomize
);
```

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/region-search.ts` | Add `heroPhotoId` param, update 4 call sites and implementation |
| `src/lib/v3/intersection.ts` | Pass `heroPhoto.id` to `findValidRegionAssignment()` |

## Testing

After this fix, rejected layouts will display the hero photo instead of a black rectangle, making it easier to visually evaluate whether the rejection was appropriate.
