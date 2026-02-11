

# Template-Driven V4 Layout Engine

## The Problem Today

The V4 engine has two disconnected systems:

1. **Template Registry** (`hero-constraints.ts`): 8 carefully rated templates defining topologies, canvas AR ranges, hero AR affinities, area fraction ranges, and valid positions. Never imported by V4.

2. **Layout Engine** (`layoutWorker.ts`): Hardcodes a single `CORNER_ANCHOR_TEMPLATE` constant with only `{ min: 0.15, max: 0.40, squareMax: 0.35 }`. Always generates a corner-anchor topology with 2 regions (beside + below). The hero height is always fixed at `1.0` in normalized space regardless of the area fraction target.

The `areaFrac` parameter only influences how many photos go beside vs. below -- it does NOT control the hero's actual size. A target of `areaFrac=0.15` still produces a hero at 60% of canvas because the hero height is locked at `1.0` and the below region packs too short (the packer search radius of +/-2 row counts misses the optimal).

## Design Intent

Make the template registry the single source of truth for layout generation. Each template defines:
- **Topology**: How the canvas decomposes into regions around the hero
- **Constraints**: Which canvas ARs, hero ARs, and area fractions are valid
- **Positions**: Where the hero can go

The engine loops over matching templates, samples within their defined ranges, and lets each template's topology function build the region list. This replaces the hardcoded 2-region assumption and makes band templates, dual heroes, etc. work through the same pipeline.

## What Users Experience

- Heroes sized appropriately for the canvas (area fraction actually controls hero size, not just photo splits)
- More layout variety: band templates on square canvases, corner-anchor on all shapes
- Debug panel shows which template was selected, making it clear why a layout looks the way it does

## Architecture

### Step 1: Template topology functions

Each template ID maps to a function that, given a hero photo and area fraction, returns:
- The hero cell dimensions and position
- A list of content regions (with constraint types, offsets, and target dimensions)

```text
corner-anchor(heroAR, areaFrac, canvasAR, gap):
  hHero = sqrt(areaFrac / heroAR * canvasAR)  // hero height as fraction of canvas
  wHero = heroAR * hHero
  canvasW = canvasAR  (normalized canvas height = 1.0)
  canvasH = 1.0

  hero: { x: gap, y: gap, w: wHero, h: hHero }
  region0 (beside): height-constrained at hHero, target width = canvasW - wHero - gaps
  region1 (below):  width-constrained at canvasW, target height = 1.0 - hHero - gaps

top-band(heroAR, areaFrac, canvasAR, gap):
  hHero = areaFrac / canvasAR * (1/heroAR) ... derived so hero spans full width
  Actually: hero width = canvasW, hero height = canvasW / heroAR... 
  but scaled so area = areaFrac * canvasArea

  hero: { x: gap, y: gap, w: canvasW - 2*gap, h: heroH }
  region0 (below): width-constrained at canvasW, target height = 1.0 - heroH - gaps
  (no beside region -- band template)

left-band(heroAR, areaFrac, canvasAR, gap):
  Hero spans full height, width = heroAR * canvasH
  hero: { x: gap, y: gap, w: wHero, h: canvasH - 2*gap }
  region0 (beside): height-constrained at canvasH, target width = canvasW - wHero - gaps
  (no below region -- band template)
```

The key change: **hero height is no longer fixed at 1.0**. The normalized canvas is height=1.0, and the hero is sized as a fraction of that canvas based on the area fraction. This means `areaFrac=0.15` actually produces a hero that's ~15% of the canvas area.

### Step 2: Engine loops over matching templates

Replace the current single-template loop with:

```text
1. Find matching templates: findCandidateTemplates(1, [heroAR])
2. For each matching template:
   a. Sample canvas ARs within template.canvasAR range
   b. Sample area fractions within template.heroAreaFraction range
   c. Call template's topology function to get hero cell + regions
   d. Pack each region
   e. Score and collect candidates
3. Select best candidate (weighted random or deterministic)
```

### Step 3: Fix the coordinate system

Currently the hero is always `height: 1.0` in normalized space, and the canvas grows additively. The fix:

- Normalized canvas is always `width = canvasAR, height = 1.0`
- Hero dimensions are derived from `areaFrac`: hero area = areaFrac * canvasAR * 1.0
- For corner-anchor: `hHero = sqrt(areaFrac * canvasAR / heroAR)`, `wHero = heroAR * hHero`
- Beside region height = hHero (not 1.0)
- Below region spans full canvas width, height = 1.0 - hHero - gap

This means the canvas dimensions are known BEFORE packing, not discovered after. The packer fills regions within the pre-defined canvas rather than the canvas being whatever size falls out of packing.

### Step 4: Widen packer search radius

In `normalized-pack.ts`, replace the fixed `[0, -1, 1, -2, 2]` deltas with expanding-radius search:

```text
for radius = 0, 1, 2, ... up to maxRadius:
  try estimate - radius and estimate + radius
  if bestDeviation < 0.05: break early
maxRadius = max(estimate - 1, ceil(n/2) - estimate)
```

This ensures the packer can always find the row count that fits the target dimensions, even when the initial estimate is far off.

### Step 5: Restore rejection logging + clarify info panel

- Log each rejected candidate with geometry data for hover-to-preview in the debug panel
- Add "hero coverage: X% of canvas" to the info panel (computed from actual hero area / canvas area)
- Add descriptive labels to existing fields without removing them
- Show which template was selected

### Test matrix: hero sizing with fixed coordinate system

For heroAR=1.5, canvasAR=1.5, canvas = 1.5 x 1.0:

```text
areaFrac  hHero   wHero   heroArea  canvasArea  actual%  beside region    below region
--------  ------  ------  --------  ----------  -------  ---------------  ---------------
0.15      0.387   0.581   0.225     1.50        15.0%    0.919 x 0.387    1.50 x 0.593
0.275     0.524   0.787   0.413     1.50        27.5%    0.713 x 0.524    1.50 x 0.456
0.40      0.632   0.949   0.600     1.50        40.0%    0.551 x 0.632    1.50 x 0.348
```

Compare with current broken behavior where `areaFrac=0.15` produces ~60% hero coverage.

For heroAR=0.67 (portrait hero), canvasAR=1.5:

```text
areaFrac  hHero   wHero   heroArea  canvasArea  actual%  beside region    below region
--------  ------  ------  --------  ----------  -------  ---------------  ---------------
0.15      0.580   0.388   0.225     1.50        15.0%    1.112 x 0.580    1.50 x 0.400
0.275      0.785   0.526   0.413     1.50        27.5%    0.974 x 0.785    1.50 x 0.195
0.40      0.949   0.635   0.600     1.50        40.0%    0.865 x 0.949    1.50 x 0.031
```

Note: portrait hero at 40% area on landscape canvas leaves almost no below region -- the template constraints (heroAreaFraction.max) should prevent this naturally.

## Files Changed

| File | Change |
|------|--------|
| `src/workers/layoutWorker.ts` | Replace hardcoded CORNER_ANCHOR_TEMPLATE with template-driven loop. Import and use findCandidateTemplates. Fix coordinate system so canvas is pre-defined (W=canvasAR, H=1.0) and hero is sized within it. Add rejection logging with geometry. Compute actual hero coverage in layoutMeta. |
| `src/lib/v4/index.ts` | Same template-driven + coordinate fix changes (sync fallback path). |
| `src/lib/v3/hero-constraints.ts` | Add topology function per template (cornerAnchorTopology, topBandTopology, leftBandTopology, etc.) that returns hero cell + region specs. Export a `getTemplateTopology(templateId)` lookup. |
| `src/lib/v3/normalized-pack.ts` | Widen soft-target search from fixed deltas to expanding-radius with early termination. |
| `src/components/debug/LayoutInfoPanel.tsx` | Add "hero coverage: X% of canvas" line, template name, and descriptive labels to all existing fields (nothing removed). |

## Risks and Mitigations

- **Band templates producing bad layouts**: Band templates are already gated to square canvases and appropriate hero ARs in the registry. We can start with only corner-anchor enabled and add bands incrementally.
- **Breaking existing good layouts**: The coordinate fix changes how areaFrac maps to hero size. Current "good" layouts at areaFrac=0.275 would now produce smaller heroes. But the current heroes are visibly too large, so this is the intended correction.
- **Packer search performance**: Expanding radius adds more iterations but early termination at 5% deviation keeps it fast. Worst case for 14 photos: 7 iterations instead of 5.

