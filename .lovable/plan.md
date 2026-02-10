

# Hero Area Fraction Rating Tool

## What This Solves

Instead of manually mocking up hero placements in a design tool, you get an interactive rating tool that generates randomized hero-on-canvas configurations as simple CSS rectangles. You rate each as good/bad/skip, then export the data to find the sweet spot for hero area fractions.

## What You See

Each screen shows:
- A canvas (varying aspect ratio: portrait, square, landscape)
- 1 or 2 hero rectangles (varying AR) placed in a template position (corner, edge band, etc.)
- The remaining space is blank/gray
- Stats badge showing: hero area %, canvas AR, hero AR, template name
- Good (G) / Bad (B) / Skip (S) buttons with keyboard shortcuts
- Export JSON when done

No photo packing, no row layout -- purely macro-level hero sizing and placement.

## Generated Variations

Each trial randomizes across these dimensions:

| Dimension | Range |
|-----------|-------|
| Canvas AR | 0.65 - 1.55 (portrait to landscape) |
| Hero count | 1 (70%) or 2 (30%) |
| Hero AR | 0.5 - 2.0 (tall portrait to wide landscape) |
| Hero area fraction | 0.15 - 0.60 (deliberately wide to find boundaries) |
| Template | corner-anchor, top-band, left-band, bottom-band, right-band |
| For 2 heroes | diagonal-corners, top-band-split, side-by-side |

This gives you exposure to combinations that feel too small, too big, and just right -- exactly what's needed to calibrate the target fractions.

## Technical Plan

### New Files

**`src/pages/HeroFractionRating.tsx`** - Main page component
- Generates a batch of random hero placement configs
- Renders one at a time with CSS rectangles
- Reuses existing rating UX patterns (keyboard shortcuts, export, session persistence)
- Route added at `/hero-fraction` (dev-only, same as layout-rating)

**`src/test/layout/heroFractionGenerator.ts`** - Config generator
- `HeroPlacementConfig` type: canvasAR, heroCount, heroARs, heroAreaFraction, template
- `HeroPlacementResult` type: adds computed hero rects (x, y, w, h as % of canvas)
- `generateHeroPlacement(config)`: computes hero rectangle positions from template + area fraction
- `generateHeroFractionBatch(count)`: creates randomized batch of configs
- Templates as pure geometry functions (no layout engine dependency)

**`src/components/hero-fraction/HeroFractionVisualization.tsx`** - Canvas renderer
- CSS absolute positioning (same pattern as LayoutVisualization)
- Hero rectangles in amber/gold
- Remaining regions outlined with dashed borders and labeled "content zone"
- Stats overlay showing hero area %, hero AR, canvas AR

### Modified Files

**`src/App.tsx`** - Add route:
```
<Route path="/hero-fraction" element={<HeroFractionRating />} />
```

### Template Geometry (single hero)

Each template is a function: `(canvasW, canvasH, heroW, heroH) => { x, y }[]`

- **corner-anchor**: Hero in one of 4 corners (randomized)
- **top-band**: Hero centered at top, full width of hero
- **bottom-band**: Hero centered at bottom
- **left-band**: Hero on left, full height of hero
- **right-band**: Hero on right

### Template Geometry (dual hero)

- **diagonal-corners**: Hero 1 top-left, Hero 2 bottom-right (or mirrored)
- **top-band-split**: Both heroes side by side at top
- **side-by-side**: One left, one right

### Hero Dimensions from Area Fraction

Given target area fraction F, canvas area A, and hero AR r:

```
heroArea = F * A
heroWidth = sqrt(heroArea * r)
heroHeight = sqrt(heroArea / r)
```

Clamped to: width <= 85% canvas width, height <= 85% canvas height.
If clamped, the other dimension adjusts to maintain AR.

### Rating Data Export

```typescript
interface HeroFractionRating {
  canvasAR: number;
  heroCount: number;
  heroARs: number[];
  heroAreaFraction: number;  // The key metric we're calibrating
  template: string;
  rating: 'good' | 'bad' | 'skip';
  ratedAt: string;
}
```

### Batch Size

40 trials per session (enough variety without fatigue). Roughly:
- 28 single-hero (7 area fractions x 4 canvas/hero AR combos)
- 12 dual-hero (4 area fractions x 3 template/AR combos)

### UX Flow

1. Navigate to `/hero-fraction` in dev mode
2. See a canvas with hero rectangle(s) and blank content zones
3. Rate: G=good, B=bad, S=skip (keyboard or buttons)
4. Auto-advance to next
5. Export JSON when done
6. Analyze: group by rating, find the area fraction range where "good" clusters

