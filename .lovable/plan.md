

# Fix Hero Layout: Eliminate Black Rectangles (Revised)

## Core Insight

The row-packing algorithm works because height is the **free variable**. When we constrain both width AND height for sub-regions, we remove that flexibility and get gaps.

**Solution**: Integrate hero positioning INTO the row/column packing flow, not as a pre-carved hole.

---

## Algorithm: "Hero-Integrated Flow Packing"

### Step 1: Determine Hero Size and Position

```typescript
// Size based on area budget (scales with hero/standard ratio)
const heroSize = calculateHeroSize(hero, canvas, budget);

// Position chosen from valid anchors (100px grid, any position)
const heroPos = chooseHeroPosition(heroSize, canvas, gap, randomize);
```

### Step 2: Define Three Vertical Zones

```text
┌─────────────────────────────────┐
│         ABOVE ZONE              │  Full width rows
│         (y < heroTop)           │
├───────┬─────────────┬───────────┤
│ LEFT  │             │  RIGHT    │
│ STRIP │    HERO     │  STRIP    │  Two vertical columns
│       │             │           │
├───────┴─────────────┴───────────┤
│         BELOW ZONE              │  Full width rows
│         (y > heroBottom)        │
└─────────────────────────────────┘
```

- **Above Zone**: y from 0 to `hero.y - gap` → Pack with ROWS at full canvas width
- **Hero Zone**: y from `hero.y` to `hero.y + hero.height` → Pack with COLUMNS in left/right strips
- **Below Zone**: y from `hero.y + hero.height + gap` to canvas bottom → Pack with ROWS at full canvas width

### Step 3: Distribute Standards to Zones

Based on area proportions:

```typescript
function distributeToZones(standards, zones) {
  const totalArea = zones.above.area + zones.left.area + zones.right.area + zones.below.area;
  
  // Calculate proportional counts
  const aboveCount = Math.round(standards.length * (zones.above.area / totalArea));
  const leftCount = Math.round(standards.length * (zones.left.area / totalArea));
  const rightCount = Math.round(standards.length * (zones.right.area / totalArea));
  const belowCount = standards.length - aboveCount - leftCount - rightCount;
  
  return {
    abovePhotos: standards.slice(0, aboveCount),
    leftPhotos: standards.slice(aboveCount, aboveCount + leftCount),
    rightPhotos: standards.slice(aboveCount + leftCount, aboveCount + leftCount + rightCount),
    belowPhotos: standards.slice(aboveCount + leftCount + rightCount),
  };
}
```

### Step 4: Pack Each Zone with Appropriate Method

```typescript
// ABOVE: Row packing at full width
const aboveCells = packRowsFullWidth(abovePhotos, canvasWidth, gap, offsetY: 0);
const aboveHeight = getPackedHeight(aboveCells);

// HERO ZONE: Column packing on left and right strips
const heroY = aboveHeight + gap;
const heroZoneHeight = hero.height;

// Left strip (may be empty if hero touches left edge)
const leftWidth = hero.x - gap;
const leftCells = leftWidth > MIN_DIMENSION 
  ? packColumn(leftPhotos, leftWidth, heroZoneHeight, offsetY: heroY)
  : [];

// Right strip (may be empty if hero touches right edge)  
const rightX = hero.x + hero.width + gap;
const rightWidth = canvasWidth - rightX;
const rightCells = rightWidth > MIN_DIMENSION
  ? packColumn(rightPhotos, rightWidth, heroZoneHeight, offsetX: rightX, offsetY: heroY)
  : [];

// BELOW: Row packing at full width
const belowY = heroY + hero.height + gap;
const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, offsetY: belowY);
```

### Step 5: Assemble Final Layout

```typescript
const heroCell = {
  photoId: hero.id,
  x: hero.x,
  y: heroY,
  width: hero.width,
  height: hero.height,
};

return {
  width: canvasWidth,
  height: belowY + getPackedHeight(belowCells),
  cells: [...aboveCells, ...leftCells, heroCell, ...rightCells, ...belowCells]
};
```

---

## Why This Eliminates Black Rectangles

| Zone | Packing Method | Free Variable | Result |
|------|----------------|---------------|--------|
| Above | Row packing | Height | Rows expand to fill width perfectly |
| Left Strip | Column packing | Width | Columns expand to fill height perfectly |
| Right Strip | Column packing | Width | Columns expand to fill height perfectly |
| Below | Row packing | Height | Rows expand to fill width perfectly |

Every zone uses its natural free variable, so no gaps.

---

## Handling All Hero Positions

### Edge-Anchored (Left)
```text
Hero.x = 0, leftWidth = 0
→ All "beside" photos go to right strip
→ Right strip: single column at full zone height
```

### Edge-Anchored (Right)
```text
Hero.x + Hero.width = canvasWidth, rightWidth = 0
→ All "beside" photos go to left strip
→ Left strip: single column at full zone height
```

### Floating (Middle)
```text
Hero.x > 0 AND Hero.x + Hero.width < canvasWidth
→ Both strips get photos proportionally
→ Left strip: column packing (leftWidth × heroZoneHeight)
→ Right strip: column packing (rightWidth × heroZoneHeight)
```

### Edge-Anchored (Top)
```text
Hero.y = 0, aboveHeight = 0
→ All "above" photos go to below zone instead
→ Left/right strips still work beside hero
```

### Edge-Anchored (Bottom)
```text
Hero.y + Hero.height = canvasHeight, belowHeight = 0
→ All "below" photos go to above zone instead
→ Left/right strips still work beside hero
```

---

## Column Packing (New Function)

Row packing arranges photos horizontally with variable row height. Column packing is the inverse - arrange photos vertically with variable column width:

```typescript
function packColumn(
  photos: PhotoDimension[],
  targetWidth: number,
  maxHeight: number,
  offsetX: number,
  offsetY: number,
  gap: number
): CollageCell[] {
  // Similar to row packing but rotated 90°
  // Each "column" is actually a vertical stack
  // Width is the free variable that adjusts to fill height
  
  // For simplicity, we can use existing packPhotosIntoRegion
  // with isLandscape=false (portrait orientation preference)
  // and targetHeight = maxHeight
  
  return packPhotosIntoRegion(photos, {
    width: targetWidth,
    gap,
    offsetX,
    offsetY,
    isLandscape: false,  // Prefer vertical arrangement
    targetHeight: maxHeight,
  }).cells;
}
```

---

## Auto Orientation Fix

Also update Auto mode to use actual photo aspect ratios:

```typescript
case 'auto':
default:
  const avgAspect = dims.reduce((sum, d) => sum + d.aspectRatio, 0) / dims.length;
  // Use actual average, clamped to reasonable range
  targetAspect = Math.max(0.6, Math.min(2.0, avgAspect));
  isLandscape = targetAspect >= 1.0;
  break;
```

---

## File Changes

| File | Change |
|------|--------|
| `src/lib/heroLayout.ts` | Replace region-based with zone-based flow packing |
| `src/lib/heroLayout.ts` | Add column packing for left/right strips |
| `src/lib/heroLayout.ts` | Simplify to 4 zones: above, left, right, below |
| `src/lib/collageLayout.ts` | Update Auto orientation to use actual aspect ratio |

---

## Expected Results

1. **No black rectangles** - Each zone fills completely using its natural flexibility
2. **Hero can float anywhere** - Left/right strips handle any X position
3. **Maintains variety** - Hero position still chosen from valid 100px grid anchors
4. **Simpler mental model** - Four zones instead of complex L-shape logic

