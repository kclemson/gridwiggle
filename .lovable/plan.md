# V3 Layout Engine - Implementation Notes

## Completed: Capture Last Rejected Pack (2026-02-07)

Added `lastRejectedPack` capture to `findValidRegionAssignment` for debugging visualization when all packs are rejected.

**Changes:**
- `region-search.ts`: Added `RejectedPack` type, tracks last rejected pack in search loop, returns it when no valid assignment found
- `intersection.ts`: Handles new return shape, calls `setRejectedLayout` when `lastRejectedPack` exists

**Pending Discussion:** Balance scoring (50/50 height split) - may need adjustment to prefer better cell uniformity over height symmetry.

