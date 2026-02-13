

# GitHub-Ready Code Cleanup

## The Real Architecture

The **V4 engine** (`src/lib/v4/engine.ts`) is the production layout engine. It imports shared primitives from `src/lib/v3/` -- these are foundational math/packing modules, not a separate engine. The old V3 *orchestrator* (`intersection.ts`, `region-search.ts`) has been fully replaced by V4 but was never cleaned up.

## Tier 1: Dead Code Removal (~1,050 lines)

### 1.1 Delete `src/lib/v3/intersection.ts` (578 lines)
The old V3 orchestrator. Its main export `findValidConfiguration` has zero callers. Only `LayoutTest.tsx` imports two tiny helper functions from it (`getLastRejectedLayout`, `clearRejectedLayout`).

**Fix**: Extract those 2 functions (10 lines) into a new `src/lib/v3/rejected-layout-store.ts`, then delete `intersection.ts`.

### 1.2 Delete `src/lib/v3/region-search.ts` (473 lines)
Only imported by `intersection.ts`. Zero external consumers.

### 1.3 Remove dead exports from `src/lib/v3/utils.ts`
These functions are only called by the files being deleted above -- V4 never uses them:
- `stratifiedARDistribution` (only caller: `region-search.ts`)
- `calculateContentStats` (only caller: `intersection.ts`)
- `estimateContentPhotoArea` (only caller: `intersection.ts`)
- `isRegionViable` (only caller: `intersection.ts`)

The following stay because V4 and/or `row-pack.ts` use them: `mean`, `variance`, `coefficientOfVariation`, `shuffleArray`, `distributeByARBudget`, `deriveRegionCounts`, `deriveRegionCountsThreeWay`, `sampleCanvasARValues`, `sampleAreaFractions`, `deriveTargetRowCount`, `randomInt`, `regionArea`.

### 1.4 Remove dead export from `src/hooks/useCollageState.ts`
`updateLayoutCells` is defined and exported but never imported anywhere.

### 1.5 Remove dead ref from `src/components/CollagePreview.tsx`
`collageRef` with "Kept for potential future use" comment -- classic YAGNI.

### 1.6 Rename "V3 Tuning" label in `src/components/V3TuningSection.tsx`
Change `<span>V3 Tuning</span>` to `<span>Layout Tuning</span>`. This label is visible in the dev debug panel.

## Tier 2: Naming Cleanup (mechanical rename, separate pass)

Rename `src/lib/v3/` to `src/lib/layout/` and update all imports. This is a large but purely mechanical change -- every file that imports from `@/lib/v3/...` switches to `@/lib/layout/...`. No logic changes.

Affected import sites (~15 files): `v4/engine.ts`, `v4/index.ts`, `useCollageGeneration.ts`, `layoutGenerationService.ts`, `V3TuningSection.tsx`, `DebugPanel.tsx`, `layoutWorker.ts`, `LayoutTest.tsx`, `layoutAdapter.ts`, `types.ts` (test), `deriveRegionCounts.test.ts`, `heroFractionGenerator.ts`, `CollageSettings.tsx`, `Index.tsx`, `LayoutRating.tsx`.

Optionally also rename `V3Tuning` to `LayoutTuning` and `v3Tuning` to `layoutTuning` across hooks and components.

## Summary

| Action | File | Lines removed |
|---|---|---|
| Delete | `src/lib/v3/intersection.ts` | 578 |
| Delete | `src/lib/v3/region-search.ts` | 473 |
| Create | `src/lib/v3/rejected-layout-store.ts` | +10 |
| Edit | `src/lib/v3/utils.ts` | ~55 (4 dead functions) |
| Edit | `src/hooks/useCollageState.ts` | ~15 (1 dead function) |
| Edit | `src/components/CollagePreview.tsx` | ~3 (dead ref) |
| Edit | `src/components/V3TuningSection.tsx` | 1 (label text) |
| Edit | `src/pages/LayoutTest.tsx` | 1 (import path) |

**Net reduction**: ~1,100 lines of dead code removed.

I'd recommend doing Tier 1 now and Tier 2 (the directory rename) as a follow-up, since they're independent and Tier 1 is the high-signal cleanup.

