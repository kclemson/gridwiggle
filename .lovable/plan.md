# Convert All Hard Rejections to Soft Rejections

## Status: ✅ Implemented

Transitioned from "fail loudly" (return null) to "always succeed with diagnostics" — users always see a layout when they refresh. In dev mode, the debug log panel continues to show all rejection logs with **hoverable CSS previews** for algorithm tuning.

---

## What Changed

### Core Changes

1. **`findValidConfiguration()` always returns a config** - No more `null` return
2. **`findValidRegionAssignment()` always returns an assignment** - Fallback to all-BELOW when no valid split found
3. **`evaluateNormalizedProposal()` always returns a config** - Constraint violations become soft rejections
4. **`generateSimpleRowsLayout()` always returns a config** - AR violations become soft rejections

### Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Converted 3 hard rejection points to soft rejections; return type now `ScoredConfiguration` not `| null` |
| `src/lib/v3/region-search.ts` | Return fallback assignment when no valid found; `RegionSearchResult.assignment` always non-null |
| `src/pages/Index.tsx` | Removed rejection UI (red ring, RejectionBadge); simplified layout generation callback |
| `src/workers/layoutWorker.ts` | Removed `rejectedLayout` and `failure` from response; layout always non-null |
| `src/services/layoutGenerationService.ts` | Updated interface, removed `rejectedLayout` and `failure` |

### Preserved for Dev Mode

- **Hover previews still work**: `devLogger.warn()` calls with geometry continue to populate `LogEntry.rejectedLayout`
- **Amber ring + SoftRejectionBadge**: Shown in dev mode when layout has soft rejection
- **Debug log panel**: All `[region-reject]` and `[layout-reject]` entries still visible with hoverable CSS boxy previews

---

## Behavior After Implementation

| Scenario | Before | After |
|----------|--------|-------|
| Prominence too low (all proposals) | Red ring + error + blocked | Layout shown + amber ring (dev only) |
| Smallest cell too tiny | Red ring + error + blocked | Layout shown + amber ring (dev only) |
| No valid region split | "Couldn't generate layout" | Layout generated (fallback all-BELOW) |
| Canvas AR out of bounds | Error or soft rejection | Soft rejection (dev badge) |
| Debug log hover preview | Shows CSS boxes on hover | **Still shows CSS boxes on hover** |


