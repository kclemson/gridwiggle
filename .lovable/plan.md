
# Fix: Make Canvas AR a Soft Rejection in Region Search

## Problem Analysis

The soft rejection for canvas AR was implemented in `intersection.ts`, but the **region-search** performs canvas AR validation **earlier** and does a **hard rejection**. Looking at your screenshot logs:

```
[region-reject] Canvas AR out of range (no BESIDE)
    besideCount:0, canvasAR:0.47, allowed:0.50 - 2.25
```

This happens at `region-search.ts` line 180-194, which rejects the configuration before it ever reaches the intersection stage where soft rejection would apply.

## Solution

Convert the canvas AR check in `region-search.ts` from a hard rejection (skip/continue) to a **soft acceptance with warning**. The configuration should be added to `validRegionAssignments` with metadata indicating it's a soft rejection, and this flows through to the final layout.

## Technical Changes

### `src/lib/v3/region-search.ts`

**Current behavior** (lines 180-194, 295-310): Hard rejection via `continue`

```typescript
if (canvasAR < effectiveMinAR - AR_EPSILON || canvasAR > effectiveMaxAR + AR_EPSILON) {
  lastRejectedPack = { ... };
  devLogger.warn('region-reject', 'Canvas AR out of range (no BESIDE)', ...);
  continue;  // <-- HARD REJECTION
}
```

**New behavior**: Accept with soft rejection flag

```typescript
// Check canvas AR - soft reject if outside bounds (still valid, just not ideal)
let softRejection: { reason: string; details: Record<string, unknown> } | undefined;

if (canvasAR < effectiveMinAR - AR_EPSILON) {
  softRejection = {
    reason: 'canvas_too_tall',
    details: { canvasAR: +canvasAR.toFixed(2), allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}` },
  };
  devLogger.warn('region', 'Canvas AR below minimum (soft rejection)', softRejection.details);
  // Continue processing - don't skip
} else if (canvasAR > effectiveMaxAR + AR_EPSILON) {
  softRejection = {
    reason: 'canvas_too_wide', 
    details: { canvasAR: +canvasAR.toFixed(2), allowed: `${effectiveMinAR.toFixed(2)} - ${effectiveMaxAR.toFixed(2)}` },
  };
  devLogger.warn('region', 'Canvas AR above maximum (soft rejection)', softRejection.details);
  // Continue processing - don't skip
}
```

### `src/lib/v3/types.ts`

Add `softRejection` field to `RegionAssignment`:

```typescript
export interface RegionAssignment {
  besidePhotos: PhotoDimension[];
  belowPhotos: PhotoDimension[];
  besideRowCount: number;
  belowRowCount: number;
  score: number;
  /** Soft rejection info - layout is valid but outside aesthetic bounds */
  softRejection?: { reason: string; details: Record<string, unknown> };
}
```

### Propagation

The soft rejection needs to flow through:
1. `RegionAssignment.softRejection` → 
2. `ScoredConfiguration.softRejection` (already exists in intersection.ts) →
3. `LayoutResponse.softRejection` (already wired)

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Add `softRejection` to `RegionAssignment` interface |
| `src/lib/v3/region-search.ts` | Convert canvas AR hard rejection to soft rejection in both places (lines ~180 and ~295) |
| `src/lib/v3/intersection.ts` | Merge region assignment soft rejection with intersection-level soft rejection |

## User Outcome

- Layouts with canvas AR outside bounds (too tall/too wide) will now **succeed** instead of failing
- In dev mode: Shows amber "SOFT REJECTION" badge with details
- In production: Layout renders normally (users don't see the warning)
- Prominence violations remain hard rejections (those indicate genuinely problematic layouts)
