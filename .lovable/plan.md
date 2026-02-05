

# Plan: Remove `targetAspect` and Add Shape-Based Scoring

## Summary

Remove the vestigial `targetAspect` parameter from the entire codebase and replace it with direct `shape` enforcement in the scoring function. This ensures the user's Shape selection (Auto, Portrait, Square, Landscape) is respected without relying on a numeric target aspect ratio.

---

## The Problem

When a user selects **Portrait** or **Square**, the layout still frequently produces landscape collages because:

1. `targetAspect` is always passed as `undefined` (intentionally, to be "shape-neutral")
2. When `undefined`, the scoring penalties (`aspectDiff`, `directionPenalty`) are **disabled**
3. With no orientation enforcement, `areaCV` (cell uniformity) becomes the sole driver
4. Landscape layouts naturally score better for uniformity because photos pack more efficiently into fewer, wider rows

---

## The Solution

**Two-phase approach:**

1. **Remove `targetAspect`** - Delete the parameter from all function signatures and remove dead code that checked it
2. **Add `shape` parameter** - Pass the user's shape preference (`'auto' | 'portrait' | 'square' | 'landscape'`) to the scoring function and apply appropriate direction penalties

---

## Architecture: Before vs After

```text
BEFORE:
  targetAspect: number | undefined  -->  scorePartition()  -->  penalties disabled when undefined

AFTER:
  shape: 'auto' | 'portrait' | 'square' | 'landscape'  -->  scorePartition()  -->  direction penalty based on shape
```

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/collageLayout.ts` | Update `scorePartition`, `findBestRowSplit`, `packPhotosIntoRegion`, `RegionPackOptions`; remove `targetAspect` |
| `src/lib/heroLayout.ts` | Remove `targetAspect` from all function signatures (~8 functions); remove dead code in `calculateHeroWidthFraction` |
| `src/lib/layoutBlocks.ts` | Update `buildContentRowsBlock` type signature to accept `shape` |

---

### Phase 1: Update `collageLayout.ts`

**1.1 Update `scorePartition()` signature**

Replace `targetAspect: number | undefined` with `shape: CollageSettings['orientation']`:

```typescript
function scorePartition(
  partition: PhotoDimension[][],
  shape: CollageSettings['orientation'],  // replaces targetAspect
  baseWidth: number = 1200,
  minPhotosPerRow: number = 2
): PartitionScore
```

**1.2 Replace aspect penalty logic with shape-based direction penalty**

Remove the existing `aspectDiff` and `directionPenalty` code and replace with:

```typescript
// Calculate result aspect from partition
const resultAspect = baseWidth / totalHeight;

// Shape-based direction penalty
let directionPenalty = 0;
if (shape === 'portrait' && resultAspect >= 1.0) {
  // User wants portrait but result is landscape/square
  directionPenalty = 10.0 * (resultAspect - 0.9);
} else if (shape === 'landscape' && resultAspect <= 1.0) {
  // User wants landscape but result is portrait/square
  directionPenalty = 10.0 * (1.1 - resultAspect);
} else if (shape === 'square') {
  // Penalize deviation from 1.0
  directionPenalty = 5.0 * Math.abs(resultAspect - 1.0);
}
// shape === 'auto' --> directionPenalty stays 0 --> no bias

// Remove aspectDiff from total score
const totalScore = 
  directionPenalty +        // shape enforcement
  areaCV * 1.0 +            // uniformity
  heightCV * 0.2 +          // row height consistency
  rowBalancePenalty;        // sparse/dense row penalties
```

**1.3 Update `findBestRowSplit()` signature**

```typescript
function findBestRowSplit(
  dims: PhotoDimension[],
  shape: CollageSettings['orientation'],  // replaces targetAspect
  randomize: boolean = false,
  minPhotosPerRow: number = 2
): PhotoDimension[][]
```

Update internal call to `scorePartition()` to pass `shape` instead of `targetAspect`.

**1.4 Update `RegionPackOptions` interface**

```typescript
interface RegionPackOptions {
  width: number;
  gap: number;
  targetHeight?: number;
  tolerance?: number;
  offsetX?: number;
  offsetY?: number;
  shape?: CollageSettings['orientation'];  // replaces targetAspect
  minPhotosPerRow?: number;
}
```

**1.5 Update `packPhotosIntoRegion()`**

Remove the derived aspect logic:

```typescript
// REMOVE this line:
// const effectiveTargetAspect = targetAspect ?? (targetHeight ? width / targetHeight : undefined);

// REPLACE with passing shape directly:
const partition = findBestRowSplit(dims, shape ?? 'auto', false, minPhotosPerRow);
```

**1.6 Update `generateCollageLayout()`**

Pass `settings.orientation` (the shape) through to `generateHeroLayout`:

```typescript
return generateHeroLayout(
  photos,
  settings,              // contains orientation (shape)
  weights,
  options?.randomize ?? false,
  layoutTuning
);
```

---

### Phase 2: Update `heroLayout.ts`

**2.1 Remove `targetAspect` from public API**

Update `generateHeroLayout()` signature (line 1639):

```typescript
// BEFORE:
export function generateHeroLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  targetAspect: number | undefined,  // REMOVE
  weights: Record<string, number>,
  ...
)

// AFTER:
export function generateHeroLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  weights: Record<string, number>,
  ...
)
```

**2.2 Remove `targetAspect` from internal functions**

Functions to update (remove the `targetAspect` parameter):
- `generateSingleHeroLayout()` (line 1375)
- `generateEdgeAnchoredHeroLayout()` (line 606)
- `generateFloatingHeroLayout()` (line 967)
- `calculateHeroWidthFraction()` (line 79)

**2.3 Delete dead code in `calculateHeroWidthFraction()`**

Remove lines 95-104 that adjust hero width based on `targetAspect`:

```typescript
// DELETE this entire block:
if (targetAspect !== undefined) {
  if (targetAspect < 0.9) {
    return baseFraction * 0.70;
  } else if (targetAspect <= 1.1) {
    return baseFraction * 0.85;
  }
}
```

Just return `baseFraction` directly.

**2.4 Update all internal calls**

Update calls like:
- `generateEdgeAnchoredHeroLayout(hero, standards, canvasWidth, gap, randomize, targetAspect)` 
  becomes `generateEdgeAnchoredHeroLayout(hero, standards, canvasWidth, gap, randomize)`
- Similar for `generateFloatingHeroLayout` and `generateSingleHeroLayout`

---

### Phase 3: Update `layoutBlocks.ts`

**3.1 Update `buildContentRowsBlock()` type signature**

The `packPhotosIntoRegion` callback type needs to accept `shape`:

```typescript
export function buildContentRowsBlock(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  packPhotosIntoRegion: (dims: PhotoDimension[], options: { 
    width: number; 
    gap: number; 
    offsetX: number; 
    offsetY: number; 
    minPhotosPerRow?: number;
    shape?: CollageSettings['orientation'];  // ADD
  }) => { cells: CollageCell[]; achievedHeight: number; partition: PhotoDimension[][] },
  minPhotosPerRow: number = 2
): ContentRowsBlock | null
```

Content blocks should use `shape: 'auto'` since their shape is determined by how they stack with hero blocks.

---

## Expected Behavior After Fix

**Shape=Portrait (n=24 photos):**
- `minPhotosPerRow` range: [2, 4.9] → midpoint ~3.45
- Algorithm explores 3-9 row configurations
- A 4-row layout (aspect ~1.5) gets penalty: `10 * (1.5 - 0.9) = 6.0`
- A 6-row layout (aspect ~0.67) gets **no penalty**
- Portrait layouts now win

**Shape=Square (n=24 photos):**
- `minPhotosPerRow` range: [3.9, 5.9] → midpoint ~4.9
- A layout with aspect 0.8 gets penalty: `5 * |0.8 - 1.0| = 1.0`
- A layout with aspect 1.1 gets penalty: `5 * |1.1 - 1.0| = 0.5`
- Square-ish layouts (0.9-1.1) win

**Shape=Auto (n=24 photos):**
- No direction penalty at all
- `areaCV` (uniformity) is the sole driver
- Shape emerges naturally from photo content

---

## Summary of Removals

| Location | What's Removed |
|----------|----------------|
| `collageLayout.ts` | `targetAspect` from `RegionPackOptions`, `scorePartition`, `findBestRowSplit` |
| `heroLayout.ts` | `targetAspect` from 5 function signatures; dead code in `calculateHeroWidthFraction` |
| `layoutBlocks.ts` | Type signature update only |

---

## Validation

After implementation:
1. Test with 24 photos and Shape=Portrait - should produce tall layouts
2. Test with 24 photos and Shape=Square - should produce ~1:1 aspect layouts
3. Test with 24 photos and Shape=Landscape - should produce wide layouts
4. Test with 24 photos and Shape=Auto - should produce layouts based purely on uniformity

