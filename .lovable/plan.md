

# Fix Hero Layout: Vertical Position Variety + Row Alignment + Better 3-Row Trigger

## Overview

This plan addresses three issues:
1. **Blank rectangles** appearing at the bottom of row 2 (rounding misalignment)
2. **Hero always at top** - no vertical position variety
3. **3-row never triggers** - tolerance too strict

## Problem Analysis

### Issue 1: Row 2 Bottom Gap

In `generateEdgeAnchoredHeroLayout`, the beside cells are scaled uniformly:

```typescript
y: Math.round(cell.y * scaleFactor),
height: Math.round(cell.height * scaleFactor),
```

But row 1 and row 2 have different heights (calculated independently to fill width). After scaling and rounding:
- Row 1 bottom: `round(row1Height * scaleFactor)`
- Row 2 top: `round((row1Height + gap) * scaleFactor)` 
- Row 2 bottom: `round((row1Height + gap) * scaleFactor) + round(row2Height * scaleFactor)`
- Hero bottom: `round(combinedHeight * scaleFactor)`

These don't match due to cumulative rounding errors.

**Fix**: After scaling, explicitly align row 2's Y position so its bottom matches the hero's bottom.

### Issue 2: Hero Always at Top

Current code only varies `anchorRight` (left vs right). The hero zone is always rendered first at `y: 0`, with "below zone" photos after.

**Fix**: Add `introRows` option - sometimes pack 1-2 full-width rows BEFORE the hero zone, pushing the hero lower in the collage.

### Issue 3: 3-Row Never Triggers

Current constraints:
- Requires 8+ standards
- Tries beside counts 9→6 only
- Uses ±15% tolerance

With extreme hero aspect ratios (very wide/tall), the resulting hero width after `height × aspect` often falls outside tolerance.

**Fix**: 
- Relax tolerance to ±20% for 3-row
- Try more beside counts (12→3)
- Better row splitting for edge cases

## Technical Changes

### File: `src/lib/heroLayout.ts`

| Function | Change |
|----------|--------|
| `generateEdgeAnchoredHeroLayout` | Fix row 2 alignment by explicitly setting bottom row's Y to `heroHeight - rowHeight` |
| `generateEdgeAnchoredHeroLayout` | Add `useIntroRows` flag to place hero zone after some full-width intro rows |
| 3-row block (lines 383-446) | Relax tolerance to ±20%, try counts from 12 down to 3 |
| `packBesideAs3Rows` | Better row splitting for uneven photo counts |
| `generateFloatingHeroLayout` | Same intro rows option |

## Detailed Implementation

### Fix 1: Row 2 Alignment (Eliminate Bottom Gap)

After creating `adjustedBesideCells`, identify which cells belong to each row and force row 2's bottom to align with hero bottom:

```typescript
// After scaling beside cells, fix row alignment
const scaledHeroHeight = Math.round(heroHeight * scaleFactor);

// Separate cells by row (row 2 cells have y >= row 1 height + gap)
const row1ScaledHeight = Math.round(row1Height * scaleFactor);
const row2ScaledHeight = Math.round(row2Height * scaleFactor);

// Force row 2 to align with hero bottom
const correctRow2Y = scaledHeroHeight - row2ScaledHeight;

adjustedBesideCells = adjustedBesideCells.map(cell => {
  // Check if this is a row 2 cell (y >= row1Height threshold)
  if (cell.y >= row1ScaledHeight) {
    return {
      ...cell,
      y: correctRow2Y,
      height: row2ScaledHeight, // Ensure consistent height
    };
  }
  return cell;
});
```

This guarantees:
- Row 1: y=0, height=row1ScaledHeight
- Row 2: y=heroHeight-row2ScaledHeight, height=row2ScaledHeight
- Row 2 bottom = heroHeight (perfect alignment, no gap)

### Fix 2: Intro Rows for Vertical Position Variety

Add logic to sometimes place full-width rows BEFORE the hero zone:

```typescript
function generateEdgeAnchoredHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean
): CollageLayout {
  const shuffled = randomize ? shuffleArray(standards) : standards;
  const anchorRight = randomize ? Math.random() < 0.5 : false;
  
  // NEW: Sometimes place intro rows before hero zone (30% chance)
  const useIntroRows = randomize && standards.length >= 8 && Math.random() < 0.3;
  const introRowCount = useIntroRows ? Math.min(2, Math.floor(standards.length / 6)) : 0;
  
  // Split photos: intro rows → beside zone → below zone
  const introPhotos = shuffled.slice(0, introRowCount * 3); // ~3 photos per intro row
  const remainingPhotos = shuffled.slice(introRowCount * 3);
  
  // Pack intro rows first
  let currentY = 0;
  let introCells: CollageCell[] = [];
  if (introPhotos.length > 0) {
    introCells = packRowsFullWidth(introPhotos, canvasWidth, gap, 0);
    if (introCells.length > 0) {
      currentY = Math.max(...introCells.map(c => c.y + c.height)) + gap;
    }
  }
  
  // Now pack hero zone at currentY (not always 0!)
  // ... rest of hero packing logic, but heroCell.y = currentY instead of 0
}
```

Visual result:

```text
Standard (hero at top):            With intro rows (hero lower):
┌──────────┬───────────────┐       ┌────────────────────────────┐
│          │ A │ B │ C     │       │ X │ Y │ Z │ W              │ ← Intro row
│   HERO   ├───────────────┤       ├──────────┬─────────────────┤
│          │   D   │ E     │       │          │ A │ B │ C       │
├──────────┴───────────────┤       │   HERO   ├─────────────────┤
│ F │ G │ H │ I │ J        │       │          │   D   │ E       │
└────────────────────────────      └──────────┴─────────────────┘
```

### Fix 3: Better 3-Row Trigger

Relax constraints to make 3-row layouts happen more often:

```typescript
// Try 3-row packing for larger photosets (8+ photos)
if (standards.length >= 8) {
  // FIXED: Try more beside counts (12 down to 3)
  for (let besideCount = Math.min(12, standards.length); besideCount >= 3; besideCount--) {
    const besidePhotos = shuffled.slice(0, besideCount);
    
    // Need at least 3 photos for 3 rows (1 per row minimum)
    if (besidePhotos.length < 3) continue;
    
    const packResult = packBesideAs3Rows(besidePhotos, targetBesideWidth, gap, 0);
    
    if (packResult.combinedHeight === 0) continue;
    
    const heroHeight = packResult.combinedHeight;
    const heroWidth = heroHeight * hero.aspectRatio;
    const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
    const scaleFactor = canvasWidth / totalNaturalWidth;
    
    // FIXED: Relax tolerance to ±20% for 3-row
    if (scaleFactor < 0.80 || scaleFactor > 1.20) {
      continue; // Try fewer photos
    }
    
    // Success - build layout with 3-row packing
    // ...
  }
}
```

Also improve `packBesideAs3Rows` row splitting:

```typescript
function packBesideAs3Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): PackResult {
  if (photos.length < 3) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set() };
  }

  // IMPROVED: Better splitting for uneven counts
  // For 5 photos: [2, 2, 1], for 7: [3, 2, 2], for 9: [3, 3, 3]
  const basePerRow = Math.floor(photos.length / 3);
  const remainder = photos.length % 3;
  
  const row1Count = basePerRow + (remainder >= 1 ? 1 : 0);
  const row2Count = basePerRow + (remainder >= 2 ? 1 : 0);
  const row3Count = basePerRow;
  
  const row1Photos = photos.slice(0, row1Count);
  const row2Photos = photos.slice(row1Count, row1Count + row2Count);
  const row3Photos = photos.slice(row1Count + row2Count);

  // Ensure each row has at least 1 photo
  if (row1Photos.length === 0 || row2Photos.length === 0 || row3Photos.length === 0) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set() };
  }

  // ... rest of 3-row packing
}
```

## Expected Results

1. **No more row 2 bottom gaps** - Explicit alignment forces row 2 bottom = hero bottom
2. **Vertical position variety** - 30% chance hero appears below intro rows instead of at top
3. **3-row layouts trigger more often** - Relaxed ±20% tolerance + wider count range
4. **Better visual hierarchy** - Hero can be 2× or 3× height of adjacent photos

## Visual Summary

### Current (issues)
```text
Hero always at top. 3-row never happens. Row 2 has gap at bottom.
┌──────────┬───────────────┐
│          │ A │ B │ C     │
│   HERO   ├───────────┬───┤
│          │ D │ E     │███│ ← Gap!
└──────────┴───────────┴───┘
```

### After (fixed)

**Layout A - Standard (hero top-left):**
```text
┌──────────┬───────────────┐
│          │ A │ B │ C     │
│   HERO   ├───────────────┤  ← No gap!
│          │   D   │ E     │
└──────────┴───────────────┘
```

**Layout B - Intro rows (hero lower):**
```text
┌────────────────────────────┐
│ X │ Y │ Z │ W              │ ← Intro row (hero not at top!)
├──────────┬─────────────────┤
│          │ A │ B │ C       │
│   HERO   ├─────────────────┤
│          │   D   │ E       │
└──────────┴─────────────────┘
```

**Layout C - 3-row (large sets):**
```text
┌──────────┬─────────────────┐
│          │ A │ B │ C       │ ← Row 1
│          ├─────────────────┤
│   HERO   │  D  │  E        │ ← Row 2
│          ├─────────────────┤
│          │ F │ G │ H       │ ← Row 3
└──────────┴─────────────────┘
Hero is 3× the height of any adjacent photo!
```

## Implementation Order

1. **Fix row 2 alignment** - Add explicit Y positioning after scaling
2. **Add intro rows option** - Pack full-width rows before hero zone sometimes
3. **Improve 3-row trigger** - Relax tolerance and widen photo count range
4. **Update packBesideAs3Rows** - Better row splitting for uneven counts

