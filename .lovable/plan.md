# Plan Complete

The following changes have been implemented:

## ✅ Renamed `orientation` to `shape`
- Updated `CollageSettings` interface in `src/types/collage.ts`
- Updated default settings in `src/hooks/useCollageState.ts`
- Added localStorage migration for existing users
- Updated UI component references in `src/components/CollageSettings.tsx`
- Updated settings change detection in `src/pages/Index.tsx`
- Updated all scoring functions in `src/lib/collageLayout.ts`
- Updated logging in `src/lib/heroLayout.ts`

## ✅ Threaded shape through content-only layout pipeline
- Added `shape` parameter to `buildContentRowsBlock` in `src/lib/layoutBlocks.ts`
- Added `shape` parameter to `generateContentOnlyLayout` in `src/lib/heroLayout.ts`
- Updated `generateHeroLayout` to pass `settings.shape` to content-only layouts

The `directionPenalty` scoring now correctly applies to collages without hero photos.

