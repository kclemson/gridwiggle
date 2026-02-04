

# Hero Photo Layout: Unconstrained Anchor-Based Placement

## Core Principles (What You Keep Repeating)

1. **Heroes can anchor ANYWHERE** - corners, edges, floating, center, offset - no artificial restrictions
2. **Single validation rule**: All remaining regions must have dimensions >= 100px
3. **Aspect ratio always preserved** - hero cells exactly match their crop aspect ratio
4. **Grid-based performance** - 100px grid spacing prevents pixel-by-pixel enumeration
5. **No orientation bias** - the math decides what's valid, not arbitrary rules

---

## Simplified Model: Just (x, y, spanFraction)

No "attached edges" concept. Just positions:

```typescript
interface AnchorPosition {
  x: number;           // Hero's left edge in pixels
  y: number;           // Hero's top edge in pixels  
  spanFraction: number; // Size scaling (0.35 to 0.65)
}
```

If `x === 0`, hero happens to touch left edge. If `x === 500`, it's floating. The remaining region logic doesn't care - it just checks if there's space.

---

## Algorithm

```text
1. Generate grid of (x, y, spanFraction) candidates
   - X positions: 0, 100, 200, ... canvasWidth
   - Y positions: 0, 100, 200, ... canvasHeight
   - Span options: 0.35, 0.50, 0.65

2. For each candidate:
   - Calculate hero dimensions (preserve aspect ratio)
   - Calculate remaining regions (up to 4 strips around hero)

3. Filter: Keep candidates where ALL remaining regions >= 100px in both dimensions

4. Select: Random from valid set (or first if deterministic)

5. Pack standards into remaining regions
```

---

## Technical Implementation

### File: `src/lib/collageLayout.ts`

### Constants and Types

```typescript
const MIN_REGION_DIMENSION = 100;

interface AnchorPosition {
  x: number;
  y: number;
  spanFraction: number;
}

interface Region {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### Generate Grid Candidates

```typescript
function generateAnchorCandidates(
  canvasWidth: number,
  canvasHeight: number,
  randomize: boolean
): AnchorPosition[] {
  const step = MIN_REGION_DIMENSION;
  const candidates: AnchorPosition[] = [];
  
  const spanOptions = randomize 
    ? [0.35 + Math.random() * 0.30]
    : [0.35, 0.50, 0.65];
  
  // Generate grid of positions
  for (let x = 0; x <= canvasWidth; x += step) {
    for (let y = 0; y <= canvasHeight; y += step) {
      for (const span of spanOptions) {
        candidates.push({ x, y, spanFraction: span });
      }
    }
  }
  
  return candidates;
}
```

### Calculate Hero Dimensions

```typescript
function calculateHeroDimensions(
  anchor: AnchorPosition,
  heroAspect: number,
  canvasWidth: number,
  canvasHeight: number,
  areaBudget: number
): { x: number; y: number; width: number; height: number } {
  const targetArea = canvasWidth * canvasHeight * areaBudget;
  
  // Preserve aspect ratio: width = sqrt(area * aspect)
  let width = Math.sqrt(targetArea * heroAspect) * (anchor.spanFraction / 0.5);
  let height = width / heroAspect;
  
  // Constrain to canvas
  if (width > canvasWidth * 0.85) {
    width = canvasWidth * 0.85;
    height = width / heroAspect;
  }
  if (height > canvasHeight * 0.85) {
    height = canvasHeight * 0.85;
    width = height * heroAspect;
  }
  
  // Position: anchor is top-left, clamp to keep hero inside canvas
  const x = Math.min(anchor.x, canvasWidth - width);
  const y = Math.min(anchor.y, canvasHeight - height);
  
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}
```

### Calculate Remaining Regions

```typescript
function calculateRemainingRegions(
  hero: { x: number; y: number; width: number; height: number },
  canvasWidth: number,
  canvasHeight: number,
  gap: number
): Region[] {
  const regions: Region[] = [];
  
  // Left strip
  if (hero.x > gap) {
    regions.push({ x: 0, y: 0, width: hero.x - gap, height: canvasHeight });
  }
  
  // Right strip
  if (hero.x + hero.width < canvasWidth - gap) {
    regions.push({ 
      x: hero.x + hero.width + gap, 
      y: 0, 
      width: canvasWidth - hero.x - hero.width - gap, 
      height: canvasHeight 
    });
  }
  
  // Top strip (between left/right)
  if (hero.y > gap) {
    const left = hero.x > gap ? hero.x : 0;
    const right = hero.x + hero.width < canvasWidth - gap ? hero.x + hero.width : canvasWidth;
    if (right > left) {
      regions.push({ x: left, y: 0, width: right - left, height: hero.y - gap });
    }
  }
  
  // Bottom strip (between left/right)
  if (hero.y + hero.height < canvasHeight - gap) {
    const left = hero.x > gap ? hero.x : 0;
    const right = hero.x + hero.width < canvasWidth - gap ? hero.x + hero.width : canvasWidth;
    if (right > left) {
      regions.push({ 
        x: left, 
        y: hero.y + hero.height + gap, 
        width: right - left, 
        height: canvasHeight - hero.y - hero.height - gap 
      });
    }
  }
  
  return regions;
}
```

### Validate: The Only Filter

```typescript
function isValidAnchor(
  anchor: AnchorPosition,
  heroAspect: number,
  canvasWidth: number,
  canvasHeight: number,
  areaBudget: number,
  gap: number
): boolean {
  const hero = calculateHeroDimensions(anchor, heroAspect, canvasWidth, canvasHeight, areaBudget);
  
  if (hero.width < MIN_REGION_DIMENSION || hero.height < MIN_REGION_DIMENSION) {
    return false;
  }
  
  const regions = calculateRemainingRegions(hero, canvasWidth, canvasHeight, gap);
  
  return regions.length > 0 && regions.every(r => 
    r.width >= MIN_REGION_DIMENSION && r.height >= MIN_REGION_DIMENSION
  );
}
```

### Select and Realize

```typescript
function selectAnchor(
  candidates: AnchorPosition[],
  heroAspect: number,
  canvasWidth: number,
  canvasHeight: number,
  areaBudget: number,
  gap: number,
  randomize: boolean
): AnchorPosition | null {
  const valid = candidates.filter(c => 
    isValidAnchor(c, heroAspect, canvasWidth, canvasHeight, areaBudget, gap)
  );
  
  if (valid.length === 0) return null;
  
  return randomize 
    ? valid[Math.floor(Math.random() * valid.length)]
    : valid[0];
}
```

### Dynamic Area Budget

```typescript
function getHeroAreaBudget(heroCount: number, standardCount: number): number {
  const maxTotal = 0.70;
  const perHero = maxTotal / heroCount;
  const standardsNeed = Math.min(0.50, standardCount * 0.05);
  return Math.min(perHero, (1.0 - standardsNeed) / heroCount);
}
```

### Multi-Hero: Recursive Placement

```typescript
function placeHeroes(
  heroes: PhotoDimension[],
  standards: PhotoDimension[],
  canvasWidth: number,
  canvasHeight: number,
  gap: number,
  randomize: boolean
): { heroCells: CollageCell[]; remainingRegions: Region[] } {
  let regions: Region[] = [{ x: 0, y: 0, width: canvasWidth, height: canvasHeight }];
  const heroCells: CollageCell[] = [];
  const orderedHeroes = randomize ? shuffleArray([...heroes]) : heroes;
  
  for (const hero of orderedHeroes) {
    regions.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    const target = regions.shift();
    if (!target) break;
    
    const budget = getHeroAreaBudget(heroes.length, standards.length);
    const candidates = generateAnchorCandidates(target.width, target.height, randomize);
    const anchor = selectAnchor(candidates, hero.aspectRatio, target.width, target.height, budget, gap, randomize);
    
    if (!anchor) continue;
    
    const dims = calculateHeroDimensions(anchor, hero.aspectRatio, target.width, target.height, budget);
    heroCells.push({
      photoId: hero.id,
      x: dims.x + target.x,
      y: dims.y + target.y,
      width: dims.width,
      height: dims.height,
    });
    
    const newRegions = calculateRemainingRegions(dims, target.width, target.height, gap);
    regions.push(...newRegions.map(r => ({
      x: r.x + target.x,
      y: r.y + target.y,
      width: r.width,
      height: r.height,
    })));
  }
  
  return { heroCells, remainingRegions: regions };
}
```

### Main Entry Point

```typescript
function generateHeroLayout(
  heroes: PhotoDimension[],
  standards: PhotoDimension[],
  settings: CollageSettings,
  targetAspect: number,
  randomize: boolean
): CollageLayout {
  const baseWidth = 1200;
  const baseHeight = Math.round(baseWidth / targetAspect);
  
  const { heroCells, remainingRegions } = placeHeroes(
    heroes, standards, baseWidth, baseHeight, settings.gapSize, randomize
  );
  
  const standardCells = packStandardsIntoRegions(standards, remainingRegions, settings.gapSize);
  const allCells = [...heroCells, ...standardCells];
  const maxY = Math.max(...allCells.map(c => c.y + c.height));
  
  return { width: baseWidth, height: Math.round(maxY), cells: allCells };
}
```

### Update `generateCollageLayout()`

```typescript
const heroes = dims.filter(d => d.weight >= 2.0);
const standards = dims.filter(d => d.weight < 2.0);

if (heroes.length > 0 && standards.length > 0) {
  return generateHeroLayout(heroes, standards, settings, targetAspect, options?.randomize ?? false);
}
```

---

## Summary

| Removed | Added |
|---------|-------|
| `attachedEdges` array | Simple `(x, y, spanFraction)` |
| Edge-detection logic | Uniform position handling |
| Orientation restrictions | Single 100px validation rule |

~350 candidates generated, ~50-150 pass validation, selection is instant.

