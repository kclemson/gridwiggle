
# Fix V2 Hero-Side: Pack Beside Photos as Rows, Not a Single Column

## Problem

The V2 `strategyHeroSide` stacks beside photos **vertically in a single column**:

```text
Current V2 (BROKEN):              V1 Approach (CORRECT):
┌─────────┬────┐                  ┌─────────┬────────────┐
│         │ 1  │                  │         │  1  │  2   │
│  HERO   ├────┤                  │  HERO   ├─────┼──────┤
│         │ 2  │                  │         │  3  │  4   │
│         ├────┤                  └─────────┴─────┴──────┘
│         │ 3  │                  
│         ├────┤                  Photos arranged as 2 ROWS
│         │ 4  │                  (2 photos per row)
└─────────┴────┘                  → Each photo is wider
                                  → Much less clipping
Photos stacked as 1 COLUMN
(4 photos stacked top-to-bottom)
→ Each photo extremely short
→ Extreme clipping
```

When 4 landscape photos are stacked in a column, each one becomes extremely short to fit the narrow beside width, causing severe aspect ratio distortion.

## Solution

Change V2's `strategyHeroSide` to pack beside photos as **horizontal rows** (like V1), not a single vertical column. This requires:

1. **Add row-based packing functions** to `pack.ts` for 2-row and 3-row modes
2. **Update `strategyHeroSide`** to use row-based packing with dynamic row count selection
3. **Update `calculateOptimalHeroFraction`** calls to use the correct row count

## Technical Details

### Row Mode Selection

V1 tries multiple row modes (1, 2, 3 rows) and picks the best. For V2, we'll select row mode based on beside count:
- **1-4 photos**: 1 row (photos side-by-side in single row)
- **4-6 photos**: 2 rows (2-3 photos per row)
- **6+ photos**: 3 rows (2-4 photos per row)

This is a reasonable heuristic that can be refined later.

### Packing Math for 2 Rows

```typescript
// Split photos: [2, 2] for 4 photos
// Each row fills besideWidth exactly
// Row heights differ based on aspect ratio sums
const row1AspectSum = sum(row1.map(p => p.aspectRatio));
const row1Height = (besideWidth - gaps) / row1AspectSum;

const row2AspectSum = sum(row2.map(p => p.aspectRatio));
const row2Height = (besideWidth - gaps) / row2AspectSum;

// Total height = row1Height + gap + row2Height
```

### Hero Width Calculation

The `calculateOptimalHeroFraction` already supports 2 and 3 row modes - we just need to call it with the correct row count instead of hardcoding `1`.

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v2/pack.ts` | Add `packBeside2Rows()` and `packBeside3Rows()` functions |
| `src/lib/v2/strategy.ts` | Rewrite `strategyHeroSide` to use row-based packing with dynamic row count |

## Implementation Steps

### 1. Add `packBeside2Rows()` to pack.ts

```typescript
/**
 * Pack photos as 2 horizontal rows beside the hero.
 * Each row fills the target width exactly.
 */
export function packBeside2Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number,
  offsetY: number
): { cells: LayoutCell[]; combinedHeight: number } {
  // Split photos between 2 rows
  const midpoint = Math.ceil(photos.length / 2);
  const row1Photos = photos.slice(0, midpoint);
  const row2Photos = photos.slice(midpoint);
  
  // Calculate heights for each row to fill targetWidth
  const row1AspectSum = sum(row1Photos.map(p => p.aspectRatio));
  const row1Gaps = gap * (row1Photos.length - 1);
  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  
  const row2AspectSum = sum(row2Photos.map(p => p.aspectRatio));
  const row2Gaps = gap * (row2Photos.length - 1);
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;
  
  const combinedHeight = row1Height + gap + row2Height;
  
  // Build cells
  const cells: LayoutCell[] = [];
  
  // Row 1
  let x = offsetX;
  for (const photo of row1Photos) {
    cells.push({
      photoId: photo.id,
      x,
      y: offsetY,
      width: row1Height * photo.aspectRatio,
      height: row1Height,
    });
    x += row1Height * photo.aspectRatio + gap;
  }
  
  // Row 2
  x = offsetX;
  for (const photo of row2Photos) {
    cells.push({
      photoId: photo.id,
      x,
      y: offsetY + row1Height + gap,
      width: row2Height * photo.aspectRatio,
      height: row2Height,
    });
    x += row2Height * photo.aspectRatio + gap;
  }
  
  return { cells, combinedHeight };
}
```

### 2. Add `packBeside3Rows()` (similar pattern)

### 3. Rewrite `strategyHeroSide` to use row modes

```typescript
export function strategyHeroSide(...) {
  // Determine row count based on beside count
  const rowCount = besidePhotos.length <= 3 ? 1 
                 : besidePhotos.length <= 6 ? 2 
                 : 3;
  
  // Calculate optimal hero fraction for THIS row count
  const { fraction } = calculateOptimalHeroFraction(
    hero.aspectRatio,
    besidePhotos,
    canvasWidth,
    gap,
    rowCount  // Was hardcoded to 1!
  );
  
  const heroWidth = (canvasWidth - gap) * fraction;
  const besideWidth = canvasWidth - heroWidth - gap;
  
  // Pack beside based on row count
  let packResult;
  if (rowCount === 3) {
    packResult = packBeside3Rows(besidePhotos, besideWidth, gap, ...);
  } else if (rowCount === 2) {
    packResult = packBeside2Rows(besidePhotos, besideWidth, gap, ...);
  } else {
    packResult = packBeside1Row(besidePhotos, besideWidth, gap, ...);
  }
  
  // Hero height = beside combined height (they align perfectly)
  const heroHeight = packResult.combinedHeight;
  // ...
}
```

## Why This Works

When 4 landscape photos are arranged in 2 rows instead of 1 column:
- Each row has 2 photos filling the beside width
- Row height = besideWidth / sum(aspectRatios of 2 photos) ≈ reasonably tall
- Combined height = 2 × rowHeight + gap

Versus 1 column:
- All 4 photos must fit in heroHeight divided by 4
- Each photo becomes extremely short
- Severe horizontal clipping

The row-based approach respects photo aspect ratios naturally because photos in each row share the same height while filling the width exactly.
