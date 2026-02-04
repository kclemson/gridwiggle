
# Block-Based Layout Architecture

## ✅ IMPLEMENTED

The block-based layout architecture has been implemented in:
- `src/lib/layoutBlocks.ts` - Block types and builder functions
- `src/lib/heroLayout.ts` - Updated to use block-based approach

## Current State Analysis

| Primitive | Location | Purpose |
|-----------|----------|---------|
| `packBesideAs2Rows` | heroLayout.ts:236-307 | Pack N photos into 2 stacked rows at target width |
| `packBesideAs3Rows` | heroLayout.ts:323-423 | Pack N photos into 3 stacked rows at target width |
| `packRowsFullWidth` | heroLayout.ts:486-503 | Pack photos into full-width rows (uses `packPhotosIntoRegion`) |
| `packPhotosIntoRegion` | collageLayout.ts | Generic region packing with scoring |
| `fixRowAlignment2Row/3Row` | heroLayout.ts:513-585 | Eliminate rounding gaps in row alignments |
| `PhotoDimension` | Both files | Unified photo representation with aspect ratio + weight |

### Architectural Problems

1. **Strategy-specific code paths** - `generateEdgeAnchoredHeroLayout` and `generateFloatingHeroLayout` each ~300 lines, duplicating logic for scaling, alignment, zone assembly
2. **Fixed zone ordering** - Hard-coded sequence (intro → hero+beside → below) prevents variety
3. **Monolithic zone logic** - "Below zone" is an afterthought rather than a first-class block
4. **Hidden dependencies** - Hero block size depends on beside packing, which depends on photo distribution

---

## Proposed Architecture: Layered Block System

### Layer 1: Primitives (Keep Existing)

No changes needed to:
- `packBesideAs2Rows` / `packBesideAs3Rows`
- `packPhotosIntoRegion`
- `fixRowAlignment2Row` / `fixRowAlignment3Row`
- `PhotoDimension` type

### Layer 2: Block Types (New)

```typescript
// src/lib/layoutBlocks.ts

/**
 * A LayoutBlock is a self-contained vertical unit with fixed width.
 * Blocks can be stacked in any order to form a complete layout.
 */
interface LayoutBlock {
  type: 'hero-unit' | 'content-rows';
  cells: CollageCell[];
  height: number;
  /** Photos consumed by this block (for tracking) */
  photoIds: Set<string>;
}

/**
 * Result of building a hero unit block.
 * Contains the hero + its beside rows as one inseparable unit.
 */
interface HeroUnitBlock extends LayoutBlock {
  type: 'hero-unit';
  heroCell: CollageCell;
  besideCells: CollageCell[];
  /** Which side the hero anchors to */
  anchorSide: 'left' | 'right';
}

/**
 * Result of building content rows.
 * One or more full-width rows packed from remaining photos.
 */
interface ContentRowsBlock extends LayoutBlock {
  type: 'content-rows';
  rowCount: number;
}
```

### Layer 3: Block Builders (New)

```typescript
/**
 * Build a hero unit: hero photo + 2-3 rows of beside photos.
 * 
 * This is a self-contained unit - the hero height is determined by
 * the beside rows it's paired with. Returns null if can't build valid unit.
 */
function buildHeroUnitBlock(
  hero: PhotoDimension,
  candidates: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  options?: {
    preferredBesideCount?: number;
    anchorSide?: 'left' | 'right' | 'random';
    rowMode?: '2-row' | '3-row' | 'auto';
  }
): HeroUnitBlock | null

/**
 * Build content rows from a set of photos.
 * Uses packPhotosIntoRegion to create optimal row arrangements.
 */
function buildContentRowsBlock(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number
): ContentRowsBlock

/**
 * Stack blocks vertically and return final layout.
 * Handles Y-offset cascading and final height calculation.
 */
function stackBlocks(
  blocks: LayoutBlock[],
  canvasWidth: number,
  gap: number
): CollageLayout
```

### Layer 4: Layout Strategies (Refactored)

```typescript
/**
 * Block-based hero layout generator.
 * 
 * Algorithm:
 * 1. Build hero unit block (consumes hero + N beside photos)
 * 2. Pack remaining photos into content row blocks
 * 3. Arrange blocks (shuffle if randomize=true)
 * 4. Stack and return
 */
function generateBlockBasedHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  options: {
    randomize: boolean;
    targetAspect?: number;
  }
): CollageLayout
```

---

## Implementation Details

### buildHeroUnitBlock

Uses existing primitives but packages result as a block:

```text
Input:
  - hero: PhotoDimension (the hero photo)
  - candidates: PhotoDimension[] (photos available for beside)
  - canvasWidth, gap
  
Process:
  1. Calculate optimal hero fraction using calculateOptimalHeroFraction()
  2. Pack beside photos using packBesideAs2Rows or packBesideAs3Rows
  3. Apply unified scaling so hero + beside fill canvasWidth
  4. Apply fixRowAlignment to eliminate gaps
  5. Wrap as HeroUnitBlock

Output:
  {
    type: 'hero-unit',
    cells: [heroCell, ...besideCells],
    height: scaledHeroHeight,
    photoIds: new Set([hero.id, ...besidePhotoIds]),
    heroCell,
    besideCells,
    anchorSide
  }
```

### buildContentRowsBlock

Wraps existing `packPhotosIntoRegion`:

```text
Input:
  - photos: PhotoDimension[]
  - canvasWidth, gap

Process:
  1. Call packPhotosIntoRegion with full width
  2. Wrap result as ContentRowsBlock

Output:
  {
    type: 'content-rows',
    cells: [...rowCells],
    height: achievedHeight,
    photoIds: new Set(photos.map(p => p.id)),
    rowCount: partition.length
  }
```

### stackBlocks

Simple vertical stacking with gap management:

```text
Input:
  - blocks: LayoutBlock[]
  - canvasWidth, gap

Process:
  1. Initialize currentY = 0
  2. For each block:
     - Offset all cells by currentY
     - currentY += block.height + gap
  3. Remove trailing gap from total height

Output:
  {
    width: canvasWidth,
    height: totalHeight,
    cells: allCells
  }
```

---

## Block Arrangement Strategies

### Basic Shuffle

```typescript
// Simple: hero can appear anywhere
const blocks = [heroBlock, ...contentBlocks];
const arranged = randomize ? shuffleArray(blocks) : blocks;
return stackBlocks(arranged, canvasWidth, gap);
```

### Weighted Position (Future Enhancement)

```typescript
// Score arrangements by hero position preference
const arrangements = generateArrangements(blocks);
const scored = arrangements.map(arr => ({
  arrangement: arr,
  score: scoreHeroPosition(arr, heroBlock) // middle > edges
}));
return stackBlocks(scored[0].arrangement, canvasWidth, gap);
```

---

## File Changes

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/layoutBlocks.ts` | **CREATE** | Block types + builder functions |
| `src/lib/heroLayout.ts` | **REFACTOR** | Use blocks internally, keep public API |
| `src/lib/collageLayout.ts` | Minor update | Export any shared utilities needed |

### New File: `src/lib/layoutBlocks.ts`

~200 lines containing:
- `LayoutBlock`, `HeroUnitBlock`, `ContentRowsBlock` interfaces
- `buildHeroUnitBlock()` - wraps existing packing logic
- `buildContentRowsBlock()` - wraps packPhotosIntoRegion
- `stackBlocks()` - vertical assembly
- `shuffleBlocks()` - randomization helper

### Refactor: `src/lib/heroLayout.ts`

- `generateBlockBasedHeroLayout()` - new main entry point using blocks
- `generateSingleHeroLayout()` - routes to block-based approach
- Keep `generateEdgeAnchoredHeroLayout` as fallback (can deprecate later)
- Keep all existing primitives (packBesideAs2Rows, etc.)

---

## Visual Example

**20 photos (1 hero, 19 standard)**

Block construction:
```text
Hero Unit Block (~8 photos consumed)
┌──────────┬─────────────┐
│          │ row 1 (3)   │
│  HERO    ├─────────────┤  height: 400px
│          │ row 2 (3)   │
│          ├─────────────┤
│          │ row 3 (2)   │
└──────────┴─────────────┘

Content Block A (~4 photos)
┌─────────────────────────┐
│ photo photo photo photo │  height: 180px
└─────────────────────────┘

Content Block B (~4 photos)  
┌─────────────────────────┐
│ photo photo photo photo │  height: 200px
└─────────────────────────┘

Content Block C (~3 photos)
┌─────────────────────────┐
│ photo  photo  photo     │  height: 220px
└─────────────────────────┘
```

Possible arrangements:
```text
Shuffle 1          Shuffle 2          Shuffle 3
[A, Hero, B, C]    [Hero, A, B, C]    [A, B, C, Hero]
Hero in middle     Hero at top        Hero at bottom
```

---

## Benefits

1. **Reuses all existing primitives** - No rewriting packing algorithms
2. **Clean separation** - Blocks are independent, testable units
3. **Infinite variety** - Shuffling blocks creates visual diversity
4. **Solves the "giant below" problem** - That row becomes its own block, can appear anywhere
5. **Extensible** - Easy to add new block types (text, dividers, multi-hero)
6. **Simpler debugging** - Each block can be logged/validated independently

---

## Technical Notes

### Hero Prominence Guarantee

Even when shuffled to bottom, hero remains dominant because:
1. Hero unit consumes 6-8 photos → naturally larger than content rows
2. Hero spans 2-3 rows worth of height → taller than single content rows
3. Content rows share photos → each row is relatively small

### Backward Compatibility

- Public API (`generateHeroLayout`) unchanged
- Block-based approach used internally
- Fallback to existing strategies if block building fails

### Logging Integration

Each block builder emits `[Hero]` logs:
```typescript
console.log('[Hero] Block built', {
  type: block.type,
  photoCount: block.photoIds.size,
  height: block.height,
});
```

