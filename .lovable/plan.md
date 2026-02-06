

# V3 Canvas AR Enforcement + UI Enhancement

## Summary

Three changes:
1. **UI Enhancement**: Display canvas aspect ratio in a larger, scannable format
2. **Canvas-Level AR Enforcement**: Apply height budget at the intersection level (the "single source of truth")
3. **Remove Redundant Logic**: Simplify `pickRandomRowCount` by removing per-region AR math (now handled upstream)

---

## Design Intent

**What problem are we solving?**  
Currently, `canvas_minAR` is applied *within each region* during row count selection. But the final canvas height is the sum of hero + gap + BELOW region. This means a layout can pass all per-region checks but still produce a canvas that violates AR limits (like your 480×956 = 0.50 AR example).

**What will users experience?**  
Portrait collages will never exceed the intended proportions. With `canvas_minAR = 0.67` and width = 480, the maximum canvas height will be ~716px (not 956px).

---

## The Math

Canvas AR enforcement happens at the intersection level:

```text
maxCanvasHeight = canvasWidth / canvas_minAR
               = 480 / 0.67
               ≈ 716px
```

For corner decomposition (hero top-left):
```text
heroBottom = heroRect.y + heroRect.height
maxBelowHeight = maxCanvasHeight - heroBottom - gap
```

The BELOW region packing receives this as a `maxHeight` constraint. Row count selection becomes purely physical (cell size minimums), not AR-based.

---

## Changes

### 1. `src/pages/V3Test.tsx` — UI Enhancement

**Lines 210-214**: Update canvas stats display

```tsx
// Before
<div className="mt-2 text-xs text-muted-foreground text-center">
  Canvas: {layout.width}×{layout.height}px
</div>

// After
<div className="mt-3 text-base font-medium text-foreground text-center">
  Canvas: {layout.width}×{layout.height}px ({(layout.width / layout.height).toFixed(2)} AR, 1:{(layout.height / layout.width).toFixed(2)})
</div>
```

Shows: `Canvas: 480×716px (0.67 AR, 1:1.49)`

---

### 2. `src/lib/v3/intersection.ts` — Add Height Budget Calculation

In `evaluateProposal`, after decomposing canvas, calculate and pass height budget:

```typescript
// Calculate canvas-level height constraint
const maxCanvasHeight = canvasWidth / tuning.canvas_minAR;
const heroBottom = proposal.rect.y + proposal.rect.height;
const maxBelowHeight = maxCanvasHeight - heroBottom - gap;

devLogger.log('v3', 'Canvas height budget', {
  maxCanvasHeight: Math.round(maxCanvasHeight),
  heroBottom: Math.round(heroBottom),
  maxBelowHeight: Math.round(maxBelowHeight),
});
```

Pass `maxBelowHeight` to `packAllRegions` so unbounded regions get this constraint.

---

### 3. `src/lib/v3/entities/content-pool.ts` — Accept Canvas Height Budget

Update `packAllRegions` signature:

```typescript
export function packAllRegions(
  photos: PhotoDimension[],
  regions: RegionSpec[],
  distribution: DistributionResult,
  gap: number,
  tuning: V3Tuning,
  maxCellArea?: number,
  maxUnboundedHeight?: number  // NEW: canvas-level budget for BELOW
): PackAllRegionsResult
```

Apply `maxUnboundedHeight` to regions with `height = Infinity`:

```typescript
if (!Number.isFinite(region.height) && maxUnboundedHeight) {
  constraints.maxHeight = maxUnboundedHeight;
}
```

---

### 4. `src/lib/v3/row-pack.ts` — Simplify Row Count Selection

Remove the canvas AR derivation math from `pickRandomRowCount`. Row count is now purely physical:

```typescript
// Before (lines 282-290): Complex AR-based row bounds
const rowsForMaxAR = Math.sqrt(n * avgAR / tuning.canvas_maxAR);
const rowsForMinAR = Math.sqrt(n * avgAR / tuning.canvas_minAR);
const minRows = Math.max(physicalMinRows, Math.ceil(rowsForMaxAR));
const maxRows = Math.max(minRows, Math.floor(rowsForMinAR));

// After: Pure physical constraint + reasonable upper bound
const minRows = physicalMinRows;
const maxRows = Math.max(minRows, Math.min(n, Math.ceil(n / 2)));
```

The upper bound `ceil(n/2)` ensures at least 2 photos per row on average, preventing extreme pillar layouts. Canvas AR is enforced upstream.

---

## Files Changed

| File | Change |
|------|--------|
| `src/pages/V3Test.tsx` | Larger font, add AR in decimal and ratio format |
| `src/lib/v3/intersection.ts` | Calculate `maxCanvasHeight` and `maxBelowHeight`, pass to packing |
| `src/lib/v3/entities/content-pool.ts` | Accept `maxUnboundedHeight` param, apply to unbounded regions |
| `src/lib/v3/row-pack.ts` | Remove AR math from `pickRandomRowCount`, keep only physical constraints |

---

## Result

**Before**: 48 photos → 480×956px (0.50 AR) — violates `canvas_minAR: 0.67`

**After**: 48 photos → 480×~716px max (0.67 AR minimum) — canvas AR is enforced at the top level, and row count logic is simpler because it no longer duplicates AR concerns.

