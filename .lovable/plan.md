
# Fix Hero Layout for Large Photosets (16+ Photos)

## Root Cause

All previous fixes were added to `generateEdgeAnchoredHeroLayout`, but with 16+ photos the code uses `generateFloatingHeroLayout` instead (line 892). This function:

1. Has NO intro rows logic (hero always at top)
2. Has NO 3-row packing option
3. Does NOT apply the row alignment fix (causing black rectangles)

This explains why you see the issues despite shuffling 50+ times - the fixed code path is never reached.

## Solution Options

### Option A: Apply Fixes to Floating Layout (Recommended)

Update `generateFloatingHeroLayout` with the same improvements:
- Add intro rows option (30% chance)
- Add 3-row packing for side zones
- Apply row alignment fix after scaling

### Option B: Route Large Sets to Edge-Anchored

Change `generateSingleHeroLayout` to always use edge-anchored layout, which already has all fixes. The floating layout would become unused.

### Option C: Hybrid - Randomize Between Both

Sometimes use edge-anchored (with all fixes), sometimes use floating (updated with fixes) for even more variety.

**Recommended: Option A** - Apply the same fixes to `generateFloatingHeroLayout`

---

## Technical Changes

### File: `src/lib/heroLayout.ts`

#### 1. Add Intro Rows to Floating Layout

```typescript
function generateFloatingHeroLayout(...) {
  // NEW: Sometimes place intro rows before hero zone (30% chance)
  const useIntroRows = randomize && standards.length >= 12 && Math.random() < 0.3;
  const introRowCount = useIntroRows ? Math.min(2, Math.floor(standards.length / 8)) : 0;
  const photosPerIntroRow = 4;
  
  const introPhotos = shuffled.slice(0, introRowCount * photosPerIntroRow);
  const remainingPhotos = shuffled.slice(introRowCount * photosPerIntroRow);
  
  let currentY = 0;
  let introCells: CollageCell[] = [];
  if (introPhotos.length > 0) {
    const introResult = packPhotosIntoRegion(introPhotos, { width: canvasWidth, gap, ... });
    introCells = introResult.cells;
    currentY = Math.max(...introCells.map(c => c.y + c.height)) + gap;
  }
  
  // ... rest of layout at currentY instead of 0
}
```

#### 2. Add 3-Row Packing to Floating Layout

For side zones with many photos, try 3-row packing first:

```typescript
// Pack left side - try 3-row for many photos, then 2-row
let leftResult: PackResult;
if (leftCandidates.length >= 6) {
  const result3 = packBesideAs3Rows(leftCandidates, targetSideWidth, gap, 0);
  if (result3.combinedHeight > 0) {
    leftResult = result3;
  } else {
    leftResult = packBesideAs2Rows(leftCandidates, targetSideWidth, gap, 0);
  }
} else {
  leftResult = packBesideAs2Rows(leftCandidates, targetSideWidth, gap, 0);
}
```

#### 3. Apply Row Alignment Fix to Floating Layout

After scaling left/right cells, apply alignment fix:

```typescript
// Scale left cells
let leftCells = leftResult.cells.map(cell => ({
  ...cell,
  x: Math.round(cell.x * leftHorizontalScale),
  y: Math.round(cell.y * scaleFactor),
  width: Math.round(cell.width * leftHorizontalScale),
  height: Math.round(cell.height * scaleFactor),
}));

// FIXED: Apply row alignment fix
if ('row3Height' in leftResult) {
  leftCells = fixRowAlignment3Row(leftCells, leftResult.row1Height, ...);
} else if ('row2Height' in leftResult) {
  leftCells = fixRowAlignment2Row(leftCells, leftResult.row1Height, ...);
}

// Add currentY offset
leftCells = leftCells.map(cell => ({ ...cell, y: cell.y + currentY }));
```

#### 4. Increase Intro Row Probability

Since current 30% chance feels like less than 5%, increase to 50%:

```typescript
// In both functions
const useIntroRows = randomize && standards.length >= 8 && Math.random() < 0.5; // Was 0.3
```

---

## Summary of Changes

| Function | Change |
|----------|--------|
| `generateFloatingHeroLayout` | Add intro rows option (50% chance for large sets) |
| `generateFloatingHeroLayout` | Add 3-row packing for side zones |
| `generateFloatingHeroLayout` | Apply `fixRowAlignment2Row`/`fixRowAlignment3Row` after scaling |
| `generateEdgeAnchoredHeroLayout` | Increase intro row probability from 30% to 50% |

---

## Expected Results

1. **No more black rectangles** - Alignment fix applied to floating layout
2. **Hero position variety** - 50% chance of intro rows pushing hero lower
3. **3-row layouts appear** - Now triggered for both layout strategies
4. **All fixes work for 16+ photos** - Floating layout path now has parity

---

## Visual Comparison

### Current (floating layout, no fixes)
```text
┌────────────┬────────┬────────────┐
│    LEFT    │  HERO  │    RIGHT   │  ← Hero always at top
│   2-row    │        │    2-row   │
│  ██████    │        │   ██████   │  ← Black rectangles!
├────────────┴────────┴────────────┤
│         below zone rows          │
└──────────────────────────────────┘
```

### After (floating layout with fixes)
```text
┌──────────────────────────────────┐
│ intro row (50% chance)           │  ← Hero not always at top!
├────────────┬────────┬────────────┤
│    LEFT    │  HERO  │    RIGHT   │
│   3-row    │        │    3-row   │  ← 3-row for many photos
│   (fixed)  │        │   (fixed)  │  ← No gaps!
├────────────┴────────┴────────────┤
│         below zone rows          │
└──────────────────────────────────┘
```
