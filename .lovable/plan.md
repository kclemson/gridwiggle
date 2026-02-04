

# Improve Hero Layout: 3-Row Option + Landscape Bias + Fix Remaining Gaps

## Overview

This plan addresses three issues:
1. **Blank rectangles** still appearing under one of the hero's adjacent rows
2. **Square bias** in Auto mode limiting variety  
3. **Propose 3-row hero option** to give the algorithm more flexibility

---

## Problem Analysis

### Why Blank Rectangles Still Appear

In `packBesideAs2Rows`, each row is calculated at the same target width but produces different actual widths:

```text
Row 1: 3 photos → natural width = 580px
Row 2: 2 photos → natural width = 520px  (NARROWER)

naturalTotalWidth = max(580, 520) = 580px
```

When we scale to fill `availableBesideWidth`, only Row 1 fills perfectly. Row 2 remains 60px short, creating a black rectangle.

### Why Everything Tends Toward Square

The `findBestRowSplit` scoring in `collageLayout.ts` uses `targetAspect` from the averaged photo aspects. With mixed orientations, this averages to ~1.0. Even though hero layouts pass `undefined` for Auto mode, the below-zone row packing still inherits this square tendency.

### Why 3-Row Would Help

With 3 rows instead of 2:
- **More photos beside** = more combinations to hit the width tolerance
- **Hero 3× height** of individual photos = even stronger visual hierarchy
- **Better for larger photosets** = 20+ photos have plenty to fill 3 rows cleanly

---

## Solution

### Fix 1: Make Each Beside Row Fill Its Width Independently

Instead of using `max(row1Width, row2Width)`, scale each row independently to fill the available width:

```text
Before (unified width, causes gaps):
┌──────────┬────────────────┐
│          │ A │ B │ C │ D  │ ← Row 1 fills
│   HERO   ├────────────┬───┤
│          │ E │ F │    │   │ ← Row 2 short!
└──────────┴────────────┴───┘

After (independent row scaling):
┌──────────┬────────────────┐
│          │ A │ B │ C │ D  │ ← Row 1 scaled to fill
│   HERO   ├────────────────┤
│          │   E   │   F    │ ← Row 2 scaled to fill
└──────────┴────────────────┘
```

Each row scales to exactly fill `availableBesideWidth` (within the 10% tolerance).

### Fix 2: Bias Auto Mode Toward Landscape

For social media sharing (carousels, previews), landscape collages look better. Modify Auto mode:

```typescript
// Current: Simple average tends toward square
const avgAspect = dims.reduce((sum, d) => sum + d.aspectRatio, 0) / dims.length;

// Proposed: Bias toward landscape (1.5:1) for better social sharing
const avgAspect = dims.reduce((sum, d) => sum + d.aspectRatio, 0) / dims.length;
const landscapeBias = 1.3; // Pull toward wider layouts
targetAspect = Math.max(0.8, Math.min(2.2, avgAspect * landscapeBias));
```

This biases the collage toward 1.3-1.8 aspect ratios (wider than tall) which display better in social media carousels.

### Fix 3: Add 3-Row Beside Packing Option

Create `packBesideAs3Rows` and use it adaptively:

```typescript
// Use 3-row for large standard counts, 2-row for medium, 1-row for small
if (standards.length >= 8) {
  // Try 3-row packing (7-9 photos beside hero)
  result = packBesideAs3Rows(candidates, targetWidth, gap);
} else if (standards.length >= 4) {
  // Try 2-row packing (4-6 photos beside hero)
  result = packBesideAs2Rows(candidates, targetWidth, gap);
} else {
  // 1-row fallback
  result = packBesideAs1Row(candidates, height, width, gap);
}
```

With 3 rows:
- Hero spans all 3 rows (visually dominant)
- More photos = more flexibility to hit width tolerance
- Reduces blank rectangles for large photosets

---

## Technical Changes

### File: src/lib/heroLayout.ts

| Function | Change |
|----------|--------|
| `packBesideAs2Rows` | Scale each row independently to fill `targetWidth` exactly |
| (new) `packBesideAs3Rows` | Pack into 3 rows with independent scaling |
| `generateEdgeAnchoredHeroLayout` | Try 3-row first for larger sets, fall back to 2-row then 1-row |
| `generateFloatingHeroLayout` | Same adaptive row count logic |

### File: src/lib/collageLayout.ts

| Function | Change |
|----------|--------|
| `generateCollageLayout` (Auto mode) | Apply landscape bias (1.3×) to target aspect |

---

## Detailed Implementation

### Independent Row Scaling in `packBesideAs2Rows`

```typescript
function packBesideAs2Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): PackResult {
  // Split photos between rows
  const midpoint = Math.ceil(photos.length / 2);
  const row1Photos = photos.slice(0, midpoint);
  const row2Photos = photos.slice(midpoint);

  // Calculate natural height for each row at targetWidth
  const row1AspectSum = row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row2AspectSum = row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  
  const row1Gaps = gap * (row1Photos.length - 1);
  const row2Gaps = gap * (row2Photos.length - 1);
  
  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;

  // FIXED: Each row now fills targetWidth exactly
  // No need for naturalTotalWidth - both rows are already at targetWidth

  const combinedHeight = row1Height + gap + row2Height;
  
  // Build cells for each row (each fills targetWidth)
  const cells: CollageCell[] = [];
  
  // Row 1
  let x = offsetX;
  for (const photo of row1Photos) {
    const photoWidth = row1Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: 0,
      width: Math.round(photoWidth),
      height: Math.round(row1Height),
    });
    x += photoWidth + gap;
  }
  
  // Row 2
  x = offsetX;
  for (const photo of row2Photos) {
    const photoWidth = row2Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(row1Height + gap),
      width: Math.round(photoWidth),
      height: Math.round(row2Height),
    });
    x += photoWidth + gap;
  }

  return {
    cells,
    combinedHeight,
    row1Height,
    row2Height,
    naturalTotalWidth: targetWidth, // Both rows fill targetWidth exactly
    usedIds: new Set([...row1Photos, ...row2Photos].map(p => p.id)),
  };
}
```

This ensures **both rows fill their width exactly** - no more black rectangles from mismatched row widths.

### New 3-Row Packing Function

```typescript
function packBesideAs3Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): PackResult {
  if (photos.length < 3) {
    return { cells: [], combinedHeight: 0, ..., usedIds: new Set() };
  }

  // Split into 3 roughly equal rows
  const third = Math.ceil(photos.length / 3);
  const row1Photos = photos.slice(0, third);
  const row2Photos = photos.slice(third, third * 2);
  const row3Photos = photos.slice(third * 2);

  // Calculate heights for each row at targetWidth (each fills width exactly)
  const row1Height = (targetWidth - gap * (row1Photos.length - 1)) / 
                     row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row2Height = (targetWidth - gap * (row2Photos.length - 1)) / 
                     row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row3Height = (targetWidth - gap * (row3Photos.length - 1)) / 
                     row3Photos.reduce((sum, p) => sum + p.aspectRatio, 0);

  const combinedHeight = row1Height + gap + row2Height + gap + row3Height;

  // Build cells for each row...
  // (similar to 2-row, just with 3 passes)

  return {
    cells,
    combinedHeight,
    naturalTotalWidth: targetWidth,
    usedIds: new Set([...row1Photos, ...row2Photos, ...row3Photos].map(p => p.id)),
  };
}
```

### Adaptive Row Count Selection

```typescript
function generateEdgeAnchoredHeroLayout(...) {
  // For large sets: try 3-row first
  if (standards.length >= 8) {
    for (let besideCount = Math.min(9, standards.length); besideCount >= 6; besideCount--) {
      const result = packBesideAs3Rows(candidates, targetBesideWidth, gap, 0);
      if (validateScaleFactor(result, hero)) {
        return buildLayout(hero, result);
      }
    }
  }
  
  // For medium sets: try 2-row
  if (standards.length >= 4) {
    for (let besideCount = Math.min(6, standards.length); besideCount >= 4; besideCount--) {
      const result = packBesideAs2Rows(candidates, targetBesideWidth, gap, 0);
      if (validateScaleFactor(result, hero)) {
        return buildLayout(hero, result);
      }
    }
  }
  
  // Fallback: 1-row
  return generateEdgeAnchoredHeroLayout1Row(...);
}
```

### Landscape Bias in Auto Mode

```typescript
// In generateCollageLayout()
case 'auto':
default:
  const avgAspect = dims.reduce((sum, d) => sum + d.aspectRatio, 0) / dims.length;
  
  // Bias toward landscape for better social media display
  const landscapeBias = 1.3;
  const biasedAspect = avgAspect * landscapeBias;
  
  // Clamp to reasonable range (0.8 to 2.2)
  targetAspect = Math.max(0.8, Math.min(2.2, biasedAspect));
  isLandscape = targetAspect >= 1.0;
  break;
```

---

## Expected Results

1. **No more blank rectangles** - Each row scales independently to fill its width
2. **More landscape variety** - 1.3× bias pulls Auto mode toward wider layouts
3. **Better visual hierarchy for large sets** - 3-row packing makes hero 3× the height
4. **More flexibility** - More rows = more photos = more combinations to hit tolerance

---

## Visual Comparison

### Before (2-row with unified scaling)
```text
┌──────────────┬───────────┬─────────┐
│              │ A │ B │ C │ D │ E   │
│    HERO      ├───────────┼─────────┤
│              │ F │ G     │ █████   │ ← Black rectangle!
├──────────────┴───────────┴─────────┤
│          more photos below...      │
└────────────────────────────────────┘
```

### After (3-row with independent scaling)
```text
┌──────────────┬─────────────────────┐
│              │ A │ B │ C │ D       │ ← Row 1 fills
│              ├─────────────────────┤
│    HERO      │  E  │  F  │  G      │ ← Row 2 fills
│              ├─────────────────────┤
│              │ H │ I │ J │ K       │ ← Row 3 fills
├──────────────┴─────────────────────┤
│          more photos below...      │
└────────────────────────────────────┘
Hero is 3× the height of any individual photo!
```

