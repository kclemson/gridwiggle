

# Fix: Desktop Black Screen (Worker Crash)

## Problem
The layout worker crashes with "Cannot read properties of undefined (reading 'length')" at `packRegion`. This causes all layout generation to fail, producing a black box.

## Root Cause
The `v4/index.ts` file was updated with single-region template handling (templates like `hero-column` and `hero-row` that have only 1 content region). But the **worker's copy** of `generateCandidates` was never updated to match. When these templates are encountered:

1. `topology.regions` has only 1 entry
2. The worker builds `regions` array with 1 element
3. It then tries `regions[1]` (line 330) -- which is `undefined`
4. `packRegion(undefined, ...)` crashes accessing `undefined.photos.length`

The v4/index.ts handles this with an `isSingleRegion` flag and a separate code path that packs region 0 only, derives canvas dimensions from it, and `continue`s before reaching the two-region code. The worker is missing all of this.

## Fix

Sync the worker's `generateCandidates` function (lines 275-440 in `src/workers/layoutWorker.ts`) with the v4/index.ts version. Specifically:

1. **Add single-region detection**: Check `topology.regions.length === 1` after getting topology
2. **Route single-region templates**: When single-region, assign all content photos to region 0, pack it, derive canvas dimensions from hero + packed content, score it, and `continue` before the two-region path
3. **Guard two-region path**: Only run the existing `regions[1]` code when there are 2+ regions

This is a sync of existing, working code from `v4/index.ts` into the worker -- no new logic.

## Technical Detail

The worker duplicates the V4 layout engine because Web Workers can't share code with the main thread via standard imports. The `generateCandidates` function in the worker (lines 237-450) needs the same single-region handling that exists in `v4/index.ts` lines 283-431, including:

- `isSingleRegion` flag from `topology.regions.length === 1`
- When single-region: all photos go to region 0, skip `deriveRegionCounts`
- Region 0 constraint-aware canvas dimension derivation (width vs height constrained)
- Single-region scoring with soft penalties instead of hard rejections (AR penalty, coverage penalty, prominence penalty, content CV penalty)
- `continue` before the two-region path

