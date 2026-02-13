

# Remove Dead Code -- Safety-Verified Plan

All changes affect either unreferenced files or dev-only test tooling (gated behind `import.meta.env.DEV` in App.tsx). Zero production code paths are impacted.

## Deletions (zero importers)

- `src/lib/v3/entities/canvas.ts` -- no imports anywhere
- `src/lib/v3/entities/content-pool.ts` -- no imports anywhere  
- `src/lib/v3/entities/hero.ts` -- no imports anywhere
- `src/lib/layoutMath.ts` -- only imported by dev-only test adapter; replaced by identical functions in `v3/utils.ts`

## Edits (dev-only files)

### `src/types/collage.ts`
Remove the `LayoutTuning` interface and `DEFAULT_TUNING` constant (lines 96-149). Only consumed by the files being deleted/updated below.

### `src/test/layout/layoutAdapter.ts`
- Change import from `@/lib/layoutMath` to `@/lib/v3/utils` (same `coefficientOfVariation` and `shuffleArray`)
- Remove `randomMinPhotosPerRow` function
- Remove `tuning` field from generated test cases

### `src/test/layout/types.ts`
- Remove `LayoutTuning` from the import
- Remove `tuning?: Partial<LayoutTuning>` from `LayoutTestCase`

### `src/pages/LayoutRating.tsx`
- Remove `tuning?` from the inline type that mirrors `LayoutTestCase`

## What stays untouched

- `src/lib/v3/types.ts`, `utils.ts`, `row-pack.ts`, `normalized-pack.ts`, `hero-constraints.ts`, `intersection.ts` -- all actively used by V4 engine
- `src/lib/layoutUtils.ts` -- `reflowAfterSwap` used by Index.tsx
- All production routes (`/`, `/help`) and their dependencies

