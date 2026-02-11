

# Implement Diagonal-Corners (Dual Hero) Template

## What We're Building

A layout where two hero photos sit in opposite corners of the canvas (e.g., top-left and bottom-right), with content photos filling three remaining regions: beside hero 1, a middle band, and beside hero 2.

## Canvas Topology

```text
+------------------+------------------+
|                  |                  |
|   Hero 1 (TL)    |  Region 0       |
|                  |  (beside H1)    |
|                  |  height-constr. |
+------------------+------------------+
|                                     |
|   Region 1 (middle band)           |
|   width-constrained                |
|                                     |
+------------------+------------------+
|                  |                  |
|  Region 2        |   Hero 2 (BR)   |
|  (beside H2)     |                  |
|  height-constr.  |                  |
+------------------+------------------+
```

Three content regions:
- **Region 0** (beside hero 1): height-constrained at hero 1's height
- **Region 1** (middle band): width-constrained at full canvas width
- **Region 2** (beside hero 2): height-constrained at hero 2's height

This is a natural extension of corner-anchor -- it's essentially two corner-anchors mirrored, with a shared middle band.

## What Changes for Users

- Photos with two heroes (weight > 1) will produce visually balanced layouts with both heroes prominent in opposite corners
- Content photos distribute across 3 zones instead of 2, giving more layout variety
- Works across all canvas shapes (portrait, square, landscape) per the existing `diagonal-corners` template definition

## Technical Changes

### 1. Topology function: `diagonalCornersTopology` in `hero-constraints.ts`

Computes positions for both heroes and 3 content regions:

- Each hero gets **half** the combined area fraction (so if areaFrac = 0.30, each hero targets 0.15)
- Hero 1 at top-left, Hero 2 at bottom-right (canonical -- mirror applied later)
- Hero dimensions: `hHero = sqrt(halfFrac * canvasAR / heroAR)`, same formula as corner-anchor but with half the budget
- Region 0: beside Hero 1, height = hHero1
- Region 1: middle band, width = canvas width, height = remaining vertical space
- Region 2: beside Hero 2, height = hHero2

Returns a new `TopologyResult` variant with two hero cells:

```text
interface DualTopologyResult extends TopologyResult {
  heroCells: [HeroCell, HeroCell];  // replaces single heroCell
  regions: TopologyRegionSpec[];     // 3 regions
}
```

Wire into `getTemplateTopology` for `'diagonal-corners'`.

### 2. Candidate generation: `generateDualHeroCandidates` in `v4/index.ts` and `layoutWorker.ts`

New function parallel to `generateCandidates` but for 2 heroes:

- Detect all heroes (weight > 1), pick top 2 by weight
- Call `findCandidateTemplates(2, [hero1AR, hero2AR])`
- For each template x canvasAR x areaFrac: get topology, derive region counts (3-way proportional split based on region areas), pack all 3 regions, validate AR coherence + combined hero coverage + prominence
- Combined hero coverage ceiling: sum of both hero areas / canvas area (use existing 0.50 ceiling)
- Prominence: each hero must individually exceed `hero_minProminence` vs content

### 3. Photo split: 3-way `deriveRegionCounts` in `utils.ts`

New function `deriveRegionCountsThreeWay` that splits content photos proportionally across 3 regions by geometric area, same approach as the existing 2-way split but extended.

### 4. Main entry points: `generateCollageLayoutV4` and worker's `generateLayout`

- After extracting dimensions, count heroes (weight > 1)
- If heroCount >= 2: call `generateDualHeroCandidates`
- If heroCount == 1: call existing `generateCandidates` (unchanged)
- `LayoutCandidate` gains optional `heroCell2` field (or `heroCells: NormalizedCell[]` to generalize)
- `convertToLayout` already loops over `regions[]` generically -- just needs to emit both hero cells
- Corner mirroring: pick from `['top-left+bottom-right', 'top-right+bottom-left']` randomly

### 5. Meta and LayoutInfoPanel

- `LayoutCandidateMeta` gains `hero2AR`, `hero2Coverage` fields
- `LayoutInfoPanel` shows both heroes when present

### Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/hero-constraints.ts` | Add `diagonalCornersTopology`, wire into `getTemplateTopology` |
| `src/lib/v3/utils.ts` | Add `deriveRegionCountsThreeWay` |
| `src/lib/v4/index.ts` | Add `generateDualHeroCandidates`, update `LayoutCandidate` to support multiple hero cells, update main entry point |
| `src/workers/layoutWorker.ts` | Mirror same dual-hero changes |
| `src/components/debug/LayoutInfoPanel.tsx` | Show both heroes in info panel |

### Minimum Photo Count

The `diagonal-corners` template works on all canvas shapes (AR 0.50-2.25). Dual hero requires enough content to fill 3 regions, so a practical minimum is ~8-10 content photos (matching `decomp_edgeMinPhotos`). Below that, the engine falls back to single-hero corner-anchor.

### Scope Boundaries

- Only `diagonal-corners` template implemented (not `side-by-side` or `top-bottom`)
- V3Test page already works generically with the V4 API -- no changes needed there
- No changes to photo weight UI (users already set weights via existing UI)

