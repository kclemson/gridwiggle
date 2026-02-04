
# Fix Hero Layout to Respect Shape + Add Variety in Auto Mode

## Problem Summary

The `targetAspect` parameter is passed to `generateHeroLayout` but **completely ignored**. For 7 photos (1 hero + 6 standard):

**Current behavior:**
- Shape setting is ignored (always landscape ~1.5 aspect)
- In "auto" mode, no variety - same layout every shuffle
- Only variation: hero on left vs right

**Root cause (lines 1172-1207 in heroLayout.ts):**
```typescript
export function generateHeroLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  targetAspect: number | undefined,  // ← RECEIVED
  weights: Record<string, number>,
  randomize: boolean
): CollageLayout {
  // ... targetAspect IS NEVER USED ANYWHERE ...
  return generateSingleHeroLayout(hero[0], standards, BASE_WIDTH, gap, randomize);
  // ↑ targetAspect not passed to generateSingleHeroLayout!
}
```

## Solution: Two-Part Fix

### Part 1: Respect Explicit Shape Settings

When user picks Portrait/Square/Landscape, generate multiple layout candidates and pick the one closest to target aspect.

| Setting | Target Aspect | Strategy |
|---------|---------------|----------|
| Landscape | 1.5 | Hero takes more width, fewer below rows |
| Square | 1.0 | Hero takes less width, more below rows |
| Portrait | 0.75 | Hero takes minimal width, many below rows |

### Part 2: Add Variety in Auto Mode

For "auto" (no target aspect), randomly select a target from [0.8, 1.0, 1.2, 1.5] each shuffle to ensure variety. This mimics how non-hero layouts get variety through different row configurations.

## Technical Changes

### File: `src/lib/heroLayout.ts`

#### 1. Thread targetAspect Through All Functions

```typescript
// Update function signatures
function generateSingleHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  targetAspect: number | undefined  // ADD
): CollageLayout

function generateEdgeAnchoredHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  targetAspect: number | undefined  // ADD
): CollageLayout

function generateFloatingHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  targetAspect: number | undefined  // ADD
): CollageLayout
```

#### 2. Auto Mode: Random Target for Variety

In `generateHeroLayout`, when `targetAspect` is undefined (auto mode), pick a random target:

```typescript
export function generateHeroLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  targetAspect: number | undefined,
  weights: Record<string, number>,
  randomize: boolean
): CollageLayout {
  // ... existing hero/standard separation ...

  // For auto mode: pick random target for variety
  let effectiveTarget = targetAspect;
  if (effectiveTarget === undefined && randomize) {
    const autoTargets = [0.8, 1.0, 1.2, 1.5];
    effectiveTarget = autoTargets[Math.floor(Math.random() * autoTargets.length)];
  }

  if (heroes.length === 1) {
    return generateSingleHeroLayout(
      heroes[0], standards, BASE_WIDTH, gap, randomize, effectiveTarget
    );
  }
  // ...
}
```

#### 3. Generate Multiple Candidates, Score by Aspect

In `generateEdgeAnchoredHeroLayout`, try multiple configurations and pick best:

```typescript
interface HeroLayoutCandidate {
  layout: CollageLayout;
  aspectRatio: number;
  aspectError: number;
}

function generateEdgeAnchoredHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  targetAspect: number | undefined
): CollageLayout {
  const shuffled = randomize ? shuffleArray(standards) : standards;
  const candidates: HeroLayoutCandidate[] = [];

  // Try multiple configurations
  for (const anchorRight of [false, true]) {
    for (const widthFractionMultiplier of [0.7, 0.85, 1.0, 1.15]) {
      const layout = tryPackHeroLayout(
        hero, shuffled, canvasWidth, gap, anchorRight, widthFractionMultiplier
      );
      if (layout) {
        const aspectRatio = layout.width / layout.height;
        const aspectError = targetAspect 
          ? Math.abs(aspectRatio - targetAspect) / targetAspect
          : 0;
        candidates.push({ layout, aspectRatio, aspectError });
      }
    }
  }

  if (candidates.length === 0) {
    return fallbackLayout(...);
  }

  // Sort by aspect error (lowest first)
  candidates.sort((a, b) => a.aspectError - b.aspectError);
  
  // Pick best match (or random from top 3 for variety in auto)
  if (targetAspect !== undefined) {
    return candidates[0].layout; // Best match for explicit shape
  } else {
    const topN = Math.min(3, candidates.length);
    const idx = Math.floor(Math.random() * topN);
    return candidates[idx].layout;
  }
}
```

#### 4. Adjust Hero Width Fraction Based on Target

The hero width fraction controls the layout aspect ratio:

```typescript
function calculateHeroWidthFraction(
  standardCount: number,
  targetAspect: number | undefined
): number {
  // Base fractions (current logic)
  let baseFraction: number;
  if (standardCount <= 4) baseFraction = 0.55;
  else if (standardCount <= 8) baseFraction = 0.45;
  else if (standardCount <= 15) baseFraction = 0.40;
  else baseFraction = 0.35;

  // Adjust for target aspect
  if (targetAspect !== undefined) {
    if (targetAspect < 0.9) {
      // Portrait: hero narrower → more below rows → taller layout
      return baseFraction * 0.7;
    } else if (targetAspect <= 1.1) {
      // Square: hero slightly narrower
      return baseFraction * 0.85;
    }
    // Landscape: use base fraction (already produces landscape)
  }
  
  return baseFraction;
}
```

## Expected Results

### With Explicit Shape Setting

**Square mode (1 hero + 6 standard):**
```text
┌────────┬─────────────────┐
│        │ A │ B │ C       │  Hero narrower (35% width)
│  HERO  ├─────────────────┤  
│        │   D   │ E       │
├────────┴─────────────────┤
│ F │ G │ H                │  More below rows
└───────────────────────────┘
Aspect ratio ≈ 1.0
```

**Portrait mode:**
```text
┌──────┬──────────────────┐
│      │ A │ B │ C        │  Hero very narrow (28% width)
│ HERO ├──────────────────┤  
│      │   D   │ E        │
├──────┴──────────────────┤
│ F │ G │ H │ I │ J       │  Many below rows
├─────────────────────────┤
│ K │ L │ M               │
└─────────────────────────┘
Aspect ratio ≈ 0.75
```

### With Auto Mode

Each shuffle randomly picks target from [0.8, 1.0, 1.2, 1.5]:
- Sometimes produces landscape hero layouts
- Sometimes produces square-ish layouts  
- Sometimes produces portrait-ish layouts
- True variety instead of always landscape

## Implementation Order

1. **Update function signatures** to accept `targetAspect` parameter
2. **Add random target selection** for auto mode in `generateHeroLayout`
3. **Update `calculateHeroWidthFraction`** to use `targetAspect`
4. **Add candidate generation + scoring** in `generateEdgeAnchoredHeroLayout`
5. **Same changes to `generateFloatingHeroLayout`** for large photosets
6. **Update multi-hero layout** to also respect target aspect

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/heroLayout.ts` | Thread targetAspect through all functions, add candidate scoring, adjust hero width based on target |

## Why This Works

The key insight is that **hero layout aspect ratio is controlled by hero width fraction**:

- Wider hero → more canvas consumed by hero zone → shorter layout → landscape
- Narrower hero → less canvas for hero → more below rows → taller → portrait

By generating candidates with different width fractions (0.7×, 0.85×, 1.0×, 1.15× of base), we create layouts with different aspect ratios. Then scoring picks the best match for the target.

For auto mode, picking a random target each shuffle ensures the 7-photo set can produce landscape, square, OR portrait layouts on different shuffles.
