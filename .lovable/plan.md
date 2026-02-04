

# Add 3 Balance Tuning Parameters

## Overview

Add three new tuning parameters that work together to prevent the hero block from consuming too many photos, ensuring better balance between the hero unit and content rows:

1. **`maxBesideFraction`** - Cap hero's beside consumption as % of total photos
2. **`minContentPhotos`** - Reserve a minimum number of photos for content blocks
3. **`minPhotosPerRow`** - Prevent sparse content rows (1-2 photos looking lonely)

## Why These Three Parameters Work Together

| Parameter | What It Controls | Default | Effect |
|-----------|------------------|---------|--------|
| `maxBesideFraction` | Hero can take at most X% of total photos | 0.6 (60%) | 20 photos → hero gets max 12 beside |
| `minContentPhotos` | Always reserve N photos for content | 4 | Guarantees at least 1 full content row |
| `minPhotosPerRow` | Content rows must have ≥N photos | 2 | Prevents lonely 1-photo rows |

These address different failure modes:
- **`maxBesideFraction`**: Scales with photo count (hero doesn't dominate as collection grows)
- **`minContentPhotos`**: Absolute floor (always have meaningful content)
- **`minPhotosPerRow`**: Quality control (no sparse, unbalanced rows)

## Technical Implementation

### 1. Update Types (`src/types/collage.ts`)

Add new fields to `LayoutTuning` interface and update `DEFAULT_TUNING`:

```typescript
export interface LayoutTuning {
  // ... existing fields ...
  
  // Balance controls (NEW)
  maxBesideFraction: number;    // Hero beside can consume at most this % of total photos (default 0.6)
  minContentPhotos: number;     // Reserve at least this many photos for content blocks (default 4)
  minPhotosPerRow: number;      // Content rows must have at least this many photos (default 2)
}

export const DEFAULT_TUNING: LayoutTuning = {
  // ... existing ...
  maxBesideFraction: 0.6,
  minContentPhotos: 4,
  minPhotosPerRow: 2,
};
```

### 2. Update Block Builder Options (`src/lib/layoutBlocks.ts`)

Add new options to `HeroUnitOptions` interface:

```typescript
export interface HeroUnitOptions {
  // ... existing ...
  /** Max fraction of total photos hero can consume (default 0.6) */
  maxBesideFraction?: number;
  /** Total photo count (needed for fraction calculation) */
  totalPhotoCount?: number;
  /** Minimum photos to reserve for content (default 4) */
  minContentPhotos?: number;
}
```

Modify `tryBuildHeroUnit` to calculate effective max:

```typescript
// Calculate effective max based on fraction and reservation
const absoluteMax = rowCount === 3 ? maxBeside3Row : maxBeside2Row;
const fractionMax = Math.floor(totalPhotoCount * maxBesideFraction);
const reservedMax = totalPhotoCount - minContentPhotos - 1; // -1 for hero itself
const effectiveMax = Math.min(absoluteMax, fractionMax, Math.max(minPhotos, reservedMax));
```

### 3. Update Hero Layout Generator (`src/lib/heroLayout.ts`)

Pass new parameters through `generateBlockBasedHeroLayout`:

```typescript
const heroBlock = buildHeroUnitBlock(
  hero,
  candidates,
  canvasWidth,
  gap,
  // ... pack functions ...
  {
    // ... existing options ...
    maxBesideFraction: tuning.maxBesideFraction,
    totalPhotoCount: standards.length + 1, // +1 for hero
    minContentPhotos: tuning.minContentPhotos,
  }
);
```

### 4. Update Partition Scoring (`src/lib/collageLayout.ts`)

Modify `scorePartition` and `findBestRowSplit` to penalize rows below `minPhotosPerRow`:

```typescript
function scorePartition(
  partition: PhotoDimension[][],
  targetAspect: number,
  isLandscape: boolean,
  baseWidth: number = 1200,
  minPhotosPerRow: number = 2  // NEW parameter
): PartitionScore {
  // ... existing code ...
  
  // Enhanced row balance penalty
  const rowSizes = partition.map(r => r.length);
  const minRowSize = Math.min(...rowSizes);
  const rowBalancePenalty = 
    (minRowSize < minPhotosPerRow ? 0.5 * (minPhotosPerRow - minRowSize) : 0) + // NEW: penalize sparse rows
    (maxRowSize > 6 ? 0.1 * (maxRowSize - 6) : 0);
  // ...
}
```

### 5. Update Tuning UI (`src/components/TuningSection.tsx`)

Add a third row for balance controls:

```tsx
{/* Row 3: Balance controls */}
<div className="grid grid-cols-3 gap-2">
  <TuningInput
    label="Max Beside %"
    tooltip="Hero row can consume at most this fraction of total photos (0.6 = 60%)"
    value={tuning.maxBesideFraction}
    onChange={(v) => onTuningChange('maxBesideFraction', v)}
    step={0.05}
    min={0.3}
    max={0.9}
  />
  <TuningInput
    label="Min Content"
    tooltip="Always reserve at least this many photos for content rows"
    value={tuning.minContentPhotos}
    onChange={(v) => onTuningChange('minContentPhotos', v)}
    min={0}
    max={10}
  />
  <TuningInput
    label="Min/Row"
    tooltip="Content rows must have at least this many photos"
    value={tuning.minPhotosPerRow}
    onChange={(v) => onTuningChange('minPhotosPerRow', v)}
    min={1}
    max={4}
  />
</div>
```

## Suggested Defaults & Tuning Guide

| Parameter | Default | Tune Up For | Tune Down For |
|-----------|---------|-------------|---------------|
| `maxBesideFraction` | **0.6** | More photos in content rows → taller layouts | Bigger hero block → shorter/wider |
| `minContentPhotos` | **4** | Guaranteed substantial content section | Allow hero to dominate when few photos |
| `minPhotosPerRow` | **2** | Denser, more balanced rows | Allow artistic single-photo accent rows |

### Interaction Examples

**20 photos, default settings:**
- `maxBesideFraction=0.6` → hero gets max 12 beside
- `minContentPhotos=4` → hero gets max 15 beside (20-4-1)
- Effective limit: 12 (fraction wins)
- Result: hero block ~13 photos, content gets ~7 photos

**10 photos, want more landscape:**
- Lower `minContentPhotos` to 2
- Lower `maxBesideFraction` to 0.7
- Result: hero can take up to 7, content gets at least 2

**10 photos, want balanced/portrait:**
- Raise `minContentPhotos` to 5
- Raise `minPhotosPerRow` to 3
- Result: hero limited to ~4 beside, content gets 5+ dense rows

## Files to Modify

1. `src/types/collage.ts` - Add 3 new fields to `LayoutTuning`
2. `src/lib/layoutBlocks.ts` - Add options, calculate effective max
3. `src/lib/heroLayout.ts` - Pass new params to `buildHeroUnitBlock`
4. `src/lib/collageLayout.ts` - Add `minPhotosPerRow` to scoring
5. `src/components/TuningSection.tsx` - Add third row of inputs

