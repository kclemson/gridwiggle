

# Unify 1-Row Packer with 2/3-Row Interface

## The Core Issue

The three packing functions have different signatures:

| Function | Input | Output |
|----------|-------|--------|
| `packBesideAs2Rows` | `targetWidth` | `{ cells, combinedHeight, naturalTotalWidth, usedIds, row1Height, row2Height }` |
| `packBesideAs3Rows` | `targetWidth` | `{ cells, combinedHeight, naturalTotalWidth, usedIds, row1Height, row2Height, row3Height }` |
| `packBesideAs1Row` | `targetHeight` | `{ cells, usedIds }` |

The 1-row function has inverted geometry—it takes height as input rather than width. This prevents it from being used in the block-based path, which expects width-in, height-out.

## The Fix: Unify the Interface

Change `packBesideAs1Row` to match the 2/3-row pattern:
- **Input**: `targetWidth` (not `targetHeight`)
- **Output**: Return full `PackResult` with `combinedHeight` and `naturalTotalWidth`

The math is actually simpler for 1 row:
```text
Given: targetWidth, photos with aspect ratios
For a single row: height = (targetWidth - gaps) / sum(aspectRatios)
```

---

## Changes

### File 1: `src/lib/heroLayout.ts`

**Refactor `packBesideAs1Row`** (lines 387-435)

Current signature:
```typescript
function packBesideAs1Row(
  photos: PhotoDimension[],
  targetHeight: number,          // ← height-based input
  availableWidth: number,
  gap: number,
  offsetX: number
): { cells: CollageCell[]; usedIds: Set<string> }  // ← minimal output
```

New signature (matching 2/3-row):
```typescript
interface PackResult1Row extends PackResult {
  rowHeight: number;
}

function packBesideAs1Row(
  photos: PhotoDimension[],
  targetWidth: number,           // ← width-based input (like 2/3-row)
  gap: number,
  offsetX: number
): PackResult1Row               // ← full PackResult output
```

New implementation:
```typescript
function packBesideAs1Row(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): PackResult1Row {
  if (photos.length === 0 || targetWidth < MIN_DIMENSION) {
    return { 
      cells: [], 
      combinedHeight: 0, 
      naturalTotalWidth: 0, 
      usedIds: new Set(),
      rowHeight: 0 
    };
  }

  // Calculate row height to fill targetWidth exactly
  const aspectSum = photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const gapsTotal = gap * Math.max(0, photos.length - 1);
  const rowHeight = (targetWidth - gapsTotal) / aspectSum;

  if (rowHeight < MIN_DIMENSION) {
    return { 
      cells: [], 
      combinedHeight: 0, 
      naturalTotalWidth: 0, 
      usedIds: new Set(),
      rowHeight: 0 
    };
  }

  // Build cells - each photo scaled to rowHeight
  const cells: CollageCell[] = [];
  let x = offsetX;

  for (const photo of photos) {
    const photoWidth = rowHeight * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: 0,
      width: Math.round(photoWidth),
      height: Math.round(rowHeight),
    });
    x += photoWidth + gap;
  }

  return {
    cells,
    combinedHeight: rowHeight,      // 1 row = height is the row height
    naturalTotalWidth: targetWidth, // Fills exactly
    usedIds: new Set(photos.map(p => p.id)),
    rowHeight,
  };
}
```

**Update call sites in `heroLayout.ts`** that use the old signature (lines 986-988, 1551-1553):

These edge-anchored paths currently call:
```typescript
const { cells: besideCells, usedIds } = packBesideAs1Row(
  standards,
  heroHeight,        // ← passing height
  availableWidth,    // ← and width separately
  gap,
  besideStartX
);
```

They need to be updated to use the new width-first interface, or we keep a small internal helper for the legacy height-based call.

**Recommendation**: Since the edge-anchored paths already know `heroHeight` and `availableWidth`, we can:
1. Keep the new `packBesideAs1Row(targetWidth, ...)` as the primary interface
2. Add a thin helper `packBesideAs1RowWithHeight(targetHeight, availableWidth, ...)` that the edge-anchored paths use—this is minimal and just calls the main function after computing the width that corresponds to that height constraint

Actually, looking closer at the edge-anchored usage, it passes `availableWidth` separately because it wants to check if photos fit within a tolerance. The new width-based function naturally handles this by computing the height that fills the width exactly.

---

### File 2: `src/lib/layoutBlocks.ts`

**Update `tryBuildHeroUnit`** (lines 225-310)

1. Change signature to accept `rowCount: 1 | 2 | 3`
2. Add `packBesideAs1Row` parameter
3. Add 1-row case logic:

```typescript
function tryBuildHeroUnit(
  hero: PhotoDimension,
  candidates: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  rowCount: 1 | 2 | 3,  // ← expanded type
  anchorRight: boolean,
  packBesideAs1Row: (photos: PhotoDimension[], targetWidth: number, gap: number, offsetX: number) => PackResult1Row,
  packBesideAs2Rows: ...,
  packBesideAs3Rows: ...,
  ...
): HeroUnitBlock | null {
  const minPhotos = rowCount === 3 ? 3 : rowCount === 2 ? 2 : 1;
  const maxPhotos = rowCount === 3 ? maxBeside3Row : rowCount === 2 ? maxBeside2Row : maxBeside1Row;

  // ... existing loop logic ...

  // Pack beside photos based on row count
  const packResult = rowCount === 3
    ? packBesideAs3Rows(besidePhotos, targetBesideWidth, gap, 0)
    : rowCount === 2
    ? packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0)
    : packBesideAs1Row(besidePhotos, targetBesideWidth, gap, 0);

  // ... rest of logic unchanged (uses combinedHeight, naturalTotalWidth) ...
}
```

**Update `buildHeroUnitBlock`** (lines 90-220)

1. Add `packBesideAs1Row` parameter
2. Add `maxBeside1Row` option
3. Replace hardcoded threshold with math:

```typescript
import { calculateOptimalBesideRowCount } from '@/lib/layoutMath';

// Replace lines 164-167:
const optimalRows = calculateOptimalBesideRowCount(hero.aspectRatio, candidates);
const useRowMode = rowMode === 'auto'
  ? (optimalRows === 1 ? '1-row' : optimalRows === 2 ? '2-row' : '3-row')
  : rowMode;
```

---

### File 3: `src/types/collage.ts`

Add `maxBeside1Row` tuning parameter:

```typescript
export interface LayoutTuning {
  maxBeside1Row: number;      // Max photos beside hero in 1-row mode (default 4)
  maxBeside2Row: number;
  maxBeside3Row: number;
  // ... rest unchanged
}

export const DEFAULT_TUNING: LayoutTuning = {
  maxBeside1Row: 4,
  // ... rest unchanged
};
```

---

## Summary

| File | Change |
|------|--------|
| `src/lib/heroLayout.ts` | Refactor `packBesideAs1Row` to width-input interface, add `PackResult1Row` type |
| `src/lib/heroLayout.ts` | Update edge-anchored call sites (or add thin helper) |
| `src/lib/layoutBlocks.ts` | Expand `tryBuildHeroUnit` and `buildHeroUnitBlock` for 1-row support |
| `src/lib/layoutBlocks.ts` | Replace hardcoded threshold with `calculateOptimalBesideRowCount` |
| `src/types/collage.ts` | Add `maxBeside1Row` tuning parameter |

**Total**: ~60-80 lines changed across 3 files

## Expected Outcome

The math naturally selects row count based on aspect ratio geometry:

| Hero | Beside (avg) | Count | Formula | Result |
|------|--------------|-------|---------|--------|
| Landscape (1.5) | Portrait (0.7) | 3 | √(3×0.7/1.5) = 1.2 | **1 row** |
| Landscape (1.5) | Portrait (0.7) | 8 | √(8×0.7/1.5) = 1.9 | **2 rows** |
| Portrait (0.7) | Landscape (1.5) | 8 | √(8×1.5/0.7) = 4.1 | **3 rows** |

Variety emerges from the natural differences in your photo set.

