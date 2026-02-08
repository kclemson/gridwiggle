

# Convert All Hard Rejections to Soft Rejections

## Summary

Transition from "fail loudly" (return null) to "always succeed with diagnostics" — users always see a layout when they refresh. In dev mode, the debug log panel continues to show all rejection logs with **hoverable CSS previews** for algorithm tuning.

---

## Design Intent

**What problem are we solving?**
- Users currently see error states and red boxes when the algorithm can't find an "ideal" layout
- This creates a bad UX when in reality, the "rejected" layout is still better than no layout

**What will users experience after this change?**
- **Production**: Every refresh produces a visible collage — no red rings, no error messages, no "try again" prompts
- **Development**: 
  - Layouts that would have been rejected are highlighted with amber ring + SoftRejectionBadge
  - Debug log panel shows all `[region-reject]` and `[layout-reject]` entries
  - **Hovering over rejection logs shows the CSS boxy preview** (existing behavior preserved)

---

## Preserving Hover Previews (Dev Mode)

The existing hover preview system will continue to work because:

1. **Geometry capture stays unchanged**: `devLogger.warn()` calls in `region-search.ts` and `intersection.ts` already pass `RejectedLayoutGeometry` as the 4th argument
2. **LogEntry.rejectedLayout preserved**: The `rejectedLayout` field continues to be populated on warn/error logs
3. **Worker→Main thread transfer unchanged**: `workerLogs` array transfers complete LogEntry objects including geometry
4. **DebugLogPanel rendering unchanged**: The HoverCard wrapper with RejectedLayoutPreview component remains intact

The key insight: **soft rejections still log warnings** — they just don't return `null`. The geometry is captured for visualization regardless of whether the layout is "accepted" or "soft-rejected".

---

## Implementation

### File: `src/lib/v3/intersection.ts`

**Change 1: evaluateNormalizedProposal always returns a config (never null)**

Convert prominence and smallest-cell validation failures from `return null` to `softRejection` annotation. **Continue to log warnings with geometry** for dev hover preview:

```typescript
// Lines 341-363 - Prominence validation
if (!prominence.valid) {
  const rejectedCells = computeRejectedCells();
  const details = { ... };
  
  // Still log warning WITH GEOMETRY for hover preview
  devLogger.warn('layout-reject', 'Prominence too low (soft)', details, {
    cells: rejectedCells,
    canvasWidth,
    canvasHeight,
  });
  
  // Mark as soft rejection instead of returning null
  if (!softRejection) {
    softRejection = { reason: 'prominence_too_low', details };
  }
  // Remove: setRejectedLayout(...); setRejection(...); return null;
}
```

Same pattern for smallest-cell validation (lines 371-399).

**Change 2: Region assignment failure becomes soft rejection**

When `findValidRegionAssignment` returns no assignment, use a fallback assignment and mark as soft rejection:

```typescript
// Lines 183-201
if (!regionResult.assignment) {
  // Fallback: put all content in BELOW region
  const fallbackAssignment = createFallbackAssignment(contentPhotos, heroAR, normalizedGap, tuning);
  softRejection = { reason: 'no_valid_region_assignment', details: { ... } };
  // Continue with fallbackAssignment instead of returning null
}
```

**Change 3: findValidConfiguration always returns best available**

```typescript
// Lines 108-140
const allConfigs: ScoredConfiguration[] = [];

for (const proposal of proposals) {
  const config = evaluateNormalizedProposal(...);
  // config is now always non-null
  allConfigs.push(config);
}

// Sort by score (soft-rejected configs naturally score lower)
allConfigs.sort((a, b) => b.score - a.score);

// Always return best available
return allConfigs[0];
// Remove: if (validConfigs.length === 0) return null;
```

### File: `src/lib/v3/region-search.ts`

**Change 4: Region search returns fallback when no valid assignment found**

Currently returns `{ assignment: null, lastRejectedPack }`. Change to always return an assignment:

```typescript
// Lines 505-520
if (validRegionAssignments.length === 0) {
  // Create fallback assignment (e.g., all photos in BELOW)
  const fallbackResult = packToFillWidth(photos, heroAR, normalizedGap, ...);
  
  // Still log warning WITH GEOMETRY for hover preview
  devLogger.warn('region-reject', 'Using fallback assignment (all BELOW)', {
    photoCount: photos.length,
  }, lastRejectedPack ? {
    cells: lastRejectedPack.cells,
    canvasWidth: lastRejectedPack.canvasWidth,
    canvasHeight: lastRejectedPack.canvasHeight,
  } : undefined);
  
  return {
    assignment: {
      besidePhotos: [],
      belowPhotos: photos,
      besideRowCount: 0,
      belowRowCount: fallbackResult.rowCount,
      score: 0.1, // Low score so valid assignments are preferred
      softRejection: { reason: 'fallback_all_below', details: { ... } },
    },
    lastRejectedPack,
  };
}
```

### File: `src/pages/Index.tsx`

**Change 5: Remove hard rejection UI**

- Remove `rejectedLayout` state and the red ring preview (lines 288-317)
- Remove `layoutError` state for rejection cases (keep only for true exceptions)
- Keep `softRejection` state for dev mode amber ring + badge

```typescript
// Lines 271-318 - Simplified layout generation callback
if (layout) {
  setLayout(layout);
  setLayoutError(null);
  setSoftRejection(result.softRejection ?? null);
}
// Remove: the entire else branch that handles null layout
// (layout will never be null now)
```

**Change 6: Simplify preview rendering**

Remove the `rejectedLayout` conditional branch (lines 852-895):
- No more red ring preview
- No more RejectionBadge in preview area

Keep the soft rejection amber ring (dev-only):
```typescript
{import.meta.env.DEV && softRejection && (
  <div className="ring-2 ring-amber-500 ...">
    ...
    <SoftRejectionBadge ... />
  </div>
)}
```

### File: `src/workers/layoutWorker.ts`

**Change 7: Worker response always has layout**

- Remove `rejectedLayout` from response (no longer needed for UI)
- Keep `softRejection` for dev logging/display
- Remove `failure` field (layout always returned)

```typescript
const response: LayoutResponse = {
  type: 'result',
  requestId,
  layout: result.layout,  // Always non-null now
  durationMs,
  logs: isDev ? workerLogs : undefined,
  softRejection: result.softRejection,
  // Remove: failure, rejectedLayout
};
```

### File: `src/services/layoutGenerationService.ts`

**Change 8: Service interface cleanup**

```typescript
export interface LayoutGenerationResult {
  layout: CollageLayout;  // No longer nullable
  durationMs: number;
  logs?: LogEntry[];
  usedWorker: boolean;
  softRejection?: { reason: string; details: Record<string, unknown> };
  // Remove: failure, rejectedLayout
}
```

---

## Dev Mode Hover Preview: Unchanged Flow

```text
┌─────────────────────────────────────────────────────────────────────┐
│ 1. region-search.ts / intersection.ts                              │
│    devLogger.warn('region-reject', label, data, geometryObject)    │
│                          ↓                                         │
│ 2. devLogger stores entry with rejectedLayout field                │
│                          ↓                                         │
│ 3. Worker collects logs in workerLogs array                        │
│                          ↓                                         │
│ 4. Worker posts response with logs: workerLogs                     │
│                          ↓                                         │
│ 5. DebugLogPanel receives logs, renders each entry                 │
│    - If entry.rejectedLayout exists → HoverCard wrapper            │
│    - On hover → RejectedLayoutPreview renders CSS boxes            │
└─────────────────────────────────────────────────────────────────────┘
```

This flow is **completely unchanged** — soft rejections still log warnings, warnings still have geometry attached, hover previews still work.

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Convert 3 hard rejection points to soft rejections; keep geometry logging |
| `src/lib/v3/region-search.ts` | Return fallback assignment when no valid found; keep geometry logging |
| `src/pages/Index.tsx` | Remove rejection UI (red ring, error states); keep dev soft-rejection badge |
| `src/workers/layoutWorker.ts` | Remove `rejectedLayout` and `failure` from response |
| `src/services/layoutGenerationService.ts` | Update interface, remove `rejectedLayout` and `failure` |

---

## Test Matrix: Expected Behavior Changes

| Scenario | Before | After |
|----------|--------|-------|
| Prominence too low (all proposals) | Red ring + error + blocked | Amber ring (dev) + layout shown |
| Smallest cell too tiny | Red ring + error + blocked | Amber ring (dev) + layout shown |
| No valid region split | "Couldn't generate layout" | Layout generated (may be suboptimal) |
| Canvas AR out of bounds | Already soft rejection | Unchanged |
| Debug log hover preview | Shows CSS boxes on hover | **Still shows CSS boxes on hover** |

---

## Validation

1. Load photo sets that currently fail (portrait-heavy, extreme ARs)
2. Verify layouts always appear — no red rings, no error messages in production
3. In dev mode:
   - Verify amber ring + SoftRejectionBadge appear for suboptimal layouts
   - **Verify hover over [region-reject] logs shows CSS boxy preview**
4. Check debug logs still capture rejection reasons with geometry attached
5. Verify high-quality layouts (that pass all constraints) show no badges/rings

