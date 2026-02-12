

# Fix: Worker Two-Region Path Still Uses Hard Rejects

## Problem
When shuffling with ~30 photos and a hero, the collage frequently shows a blank black box. This happens because the worker's two-region candidate generation path (corner-anchor templates) still uses **hard rejects** for AR coherence, hero coverage, and prominence -- while the main V4 engine (`v4/index.ts`) was updated to use soft penalties. Certain photo orderings cause every candidate to fail these hard checks, producing zero valid candidates.

## Why It Shows Up Intermittently
Shuffling randomizes photo order and template selection. Some orderings produce candidates that pass all hard checks; others don't. With ~30 photos, the geometry is tightly constrained, making hard rejection more likely.

## The Fix

**File: `src/workers/layoutWorker.ts`** (two-region path, lines ~476-517)

Replace the three hard rejects with soft penalties matching `v4/index.ts`:

1. **AR coherence** (line 476-483): Change from `continue` to a penalty variable, matching the single-region path pattern already in the worker
2. **Hero coverage** (line 485-492): Change from `continue` to a penalty variable  
3. **Prominence** (line 506-513): Change from `continue` to a penalty variable
4. **Scoring** (line 515-517): Update to subtract penalties from score (matching v4/index.ts lines 527-531), including the content uniformity penalty that exists in v4 but is missing from the worker's two-region path
5. **Add `penalties` to meta** for the two-region path (it's missing, unlike single-region which has it)

The single-region path (lines 337-427) already correctly uses soft penalties -- only the two-region path needs updating.

## Regarding Gap Variation

Different shuffles produce different canvas aspect ratios, so the same normalized gap maps to slightly different visual widths. This is inherent to the area-budget approach and not a bug. No code change needed.

## Regarding Speed

The worker now handles single-region templates natively (from the previous fix) instead of crashing and falling back to synchronous generation. This explains the speed improvement. No code change needed.

## What Does NOT Change
- Single-region path (already correct)
- Dual-hero path (already has hard rejects but those are acceptable for now since dual-hero has the single-hero fallback)
- v4/index.ts (already correct, this is syncing the worker TO it)
- Layout scoring, packing, rendering -- all untouched

