
# Tighten Hero Area Fraction Ceiling + Restore Debug Metadata

## What Problem Are We Solving

The hero is far too large in many layouts because `CORNER_ANCHOR_TEMPLATE.areaFraction.max` is set to 0.60, allowing the hero to consume 60% of canvas area on non-square canvases. With 3 evenly-spaced area fraction samples `[0.15, 0.375, 0.60]`, the highest sample produces a hero that takes ~77% of canvas height.

The hero-constraints.ts registry already documents that visual ratings support a range of 0.15-0.60, but 0.60 was an edge case outlier. A tighter ceiling of 0.40 for non-square canvases (keeping squareMax at 0.35) would match the sweet spot from the rating data.

Additionally, the debug panel has lost its rich metadata since the V4 refactor, making it hard to diagnose why a specific layout looks the way it does.

## What Users Experience

- Heroes that are appropriately prominent without overwhelming the canvas
- In dev mode: the info panel below the collage returns with all the math inputs visible (target AR, area fraction, AR deviation, region row counts, prominence ratio, score, corner)

## What Changes

| File | Change |
|------|--------|
| `src/workers/layoutWorker.ts` | 1. Lower `CORNER_ANCHOR_TEMPLATE.areaFraction.max` from 0.60 to 0.40. 2. Tighten `AR_COHERENCE_THRESHOLD` from 0.40 to 0.25. 3. Attach `meta` object to selected candidate with all generation inputs. 4. Return `layoutMeta` in the worker response alongside layout. |
| `src/lib/v4/index.ts` | Same template + threshold + metadata changes (sync fallback path). |
| `src/lib/v3/hero-constraints.ts` | Update `corner-anchor` template max from 0.60 to 0.40 (keep the registry in sync with the working values). |
| `src/services/layoutGenerationService.ts` | Pass through `layoutMeta` from worker response to caller. |
| `src/components/debug/LayoutInfoPanel.tsx` | Redesign to display V4 metadata fields: template, targetCanvasAR, actualCanvasAR, arDeviation, areaFrac, heroAR, prominenceRatio, score, corner, candidateCount, per-region sizes/rows/dimensions. |
| `src/pages/Index.tsx` / `src/hooks/useCollageState.ts` | Store and display `layoutMeta` so the info panel shows whenever a layout exists (not only on soft rejection). |

## Technical Details

### Tighten area fraction ceiling

```text
// In layoutWorker.ts and v4/index.ts:
const CORNER_ANCHOR_TEMPLATE = {
  areaFraction: { min: 0.15, max: 0.40, squareMax: 0.35 },
};

// In hero-constraints.ts (registry):
heroAreaFraction: { min: 0.15, max: 0.40, squareMax: 0.35 },
```

This changes the 3 area samples from `[0.15, 0.375, 0.60]` to `[0.15, 0.275, 0.40]`. The highest sample now produces `hHero = sqrt(0.40 * 1.5 / 1.5) = sqrt(0.40) = 0.63` -- the hero takes 63% of canvas height at the extreme, down from 77%.

### Test matrix: Hero sizing with new ceiling

For heroAR=1.5, 23 content photos:

```text
areaFrac    hHero (AR=1.0)    hHero (AR=1.5)    hHero (AR=2.0)
------------------------------------------------------------------
0.15        0.39              0.39              0.45
0.275       0.52              0.52              0.61
0.40        0.63              0.63              0.73
OLD 0.60    0.77              0.77              0.89  <-- way too big
```

### Tighten AR coherence threshold

```text
const AR_COHERENCE_THRESHOLD = 0.25;  // was 0.40
```

### Layout metadata on every candidate

Extend `LayoutCandidate` with a `meta` field populated during generation:

```text
meta: {
  targetCanvasAR: number;
  areaFrac: number;
  arDeviation: number;
  regionSizes: number[];
  regionTargetRows: number[];
  regionActualRows: number[];
  besideWidth: number;
  belowHeight: number;
  candidateCount: number;  // set after all candidates generated
}
```

The selected candidate's `meta` is returned from the worker and passed through the service layer to the UI. The info panel renders it as:

```text
Layout Info
template: corner-anchor (bottom-left)
target AR: 1.50 -> actual: 1.72 (dev: 14.7%)
area fraction: 0.275 | hero prominence: 2.34x
score: 0.872 | candidates: 11
region 0 (beside): 5 photos, 2 rows (target: 2), w=0.45
region 1 (below): 18 photos, 4 rows (target: 4), h=0.38
```

### Wire layoutMeta through the stack

1. Worker response gains `layoutMeta?: Record<string, unknown>`
2. `layoutGenerationService.ts` passes it through in the result
3. `useCollageState.ts` stores it as state
4. `Index.tsx` renders `LayoutInfoPanel` whenever `layoutMeta` is non-null (not gated on `softRejection`)
5. `LayoutInfoPanel` is updated to handle both V4 meta format and legacy soft rejection format

### Edge cases

- When layout comes from V3 fallback: no `layoutMeta` exists, info panel stays hidden
- When no candidates found: `softRejection` still returned as before, info panel shows that instead
- `squareMax` (0.35) stays unchanged since it was already validated in visual ratings
