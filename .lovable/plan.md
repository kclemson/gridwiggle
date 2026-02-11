

# New Full-Span Hero Templates

## Problem

When a tall portrait hero lands on a landscape canvas (or a wide landscape hero on a portrait canvas), the corner-anchor template produces awkward layouts — the hero either dominates 77% of the canvas height or gets artificially shrunk. Neither outcome looks good.

## User Outcome

Instead of fighting the geometry, the engine will recognize these mismatched hero/canvas combinations and use a purpose-built template where the hero naturally spans the full height (or width) as a column (or row), with all content photos packed into the remaining space beside (or below) it.

**Portrait hero + landscape canvas**: Hero becomes a full-height left/right column. Content fills the remaining width in rows.

**Landscape hero + portrait canvas**: Hero becomes a full-width top/bottom row. Content fills the remaining height in rows.

## Design

Two new single-hero templates in the registry:

**`hero-column`** (portrait hero on landscape canvas)
- Hero spans full canvas height, positioned left or right
- Content fills a single region beside the hero (width-constrained)
- Canvas AR: 1.15 - 2.25 (landscape only)
- Hero AR: 0.4 - 0.85 (portrait heroes)
- Area fraction: 0.15 - 0.35

**`hero-row`** (landscape hero on portrait canvas)
- Hero spans full canvas width, positioned top or bottom
- Content fills a single region below/above the hero (width-constrained)
- Canvas AR: 0.50 - 0.85 (portrait only)
- Hero AR: 1.2 - 3.0 (landscape heroes)
- Area fraction: 0.15 - 0.35

## Test Matrix

| Hero AR | Canvas AR | Template Selected | Hero Placement | Content Region |
|---------|-----------|-------------------|----------------|----------------|
| 0.68 | 1.5 | hero-column | Full-height left column | Rows beside it |
| 0.50 | 1.8 | hero-column | Full-height left column | Rows beside it |
| 0.68 | 1.0 | corner-anchor | Corner (unchanged) | Beside + below |
| 1.5 | 0.7 | hero-row | Full-width top row | Rows below it |
| 2.0 | 0.6 | hero-row | Full-width top row | Rows below it |
| 1.5 | 1.0 | corner-anchor | Corner (unchanged) | Beside + below |

## Technical Details

### 1. Template Registry (`src/lib/v3/hero-constraints.ts`)

Add two new entries to `HERO_TEMPLATES`:

```
hero-column:
  heroCount: 1
  canvasAR: { min: 1.15, max: 2.25 }
  heroAreaFraction: { min: 0.15, max: 0.35 }
  heroAR: { min: 0.4, max: 0.85 }
  positions: ['left', 'right']

hero-row:
  heroCount: 1
  canvasAR: { min: 0.50, max: 0.85 }
  heroAreaFraction: { min: 0.15, max: 0.35 }
  heroAR: { min: 1.2, max: 3.0 }
  positions: ['top', 'bottom']
```

### 2. Topology Functions (`src/lib/v3/hero-constraints.ts`)

**`heroColumnTopology`**: Hero height = 1.0 (full canvas height minus gaps). Hero width = heroAR * heroHeight. One content region beside it, width-constrained at `canvasAR - wHero - gaps`.

**`heroRowTopology`**: Hero width = canvasAR (full canvas width minus gaps). Hero height = heroWidth / heroAR. One content region below it, width-constrained at canvas width, target height = `1.0 - hHero - gaps`.

### 3. Template Dispatch (`src/lib/v3/hero-constraints.ts`)

Add cases to `getTemplateTopology` for `'hero-column'` and `'hero-row'`.

### 4. Generation Pipeline (`src/lib/v4/index.ts`)

No structural changes needed. The existing `generateCandidates` loop already:
- Calls `findCandidateTemplates` (which will now return hero-column/hero-row when hero AR matches)
- Calls `getTemplateTopology` (which will dispatch to the new functions)
- Packs regions generically

The only adjustment: when a template produces a single content region (no "beside" region), the pipeline needs to handle `regions.length === 1` gracefully. Currently it assumes 2 regions (beside + below). We'll add a check so that when there's only 1 region, we skip the beside-width computation and set the canvas width directly from the topology.

### 5. Region Count Derivation

For single-region templates, all content photos go into that one region. No beside/below split needed. We'll add a simple check: if `topology.regions.length === 1`, assign all content to region 0 and skip `deriveRegionCounts`.

