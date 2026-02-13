

# Cleanup Pass 2: Verified Dead Code Removal

Every item below has been individually verified via import search. Zero production code paths are affected.

## 1. Dead Application Components (3 files)

| File | Evidence |
|---|---|
| `src/components/PhotoGrid.tsx` | Zero importers. Replaced by `PhotoStrip`/`ThumbnailNavigator`. |
| `src/components/common/ImageContainer.tsx` | Zero importers anywhere in codebase. |
| `src/components/V3TuningSection.tsx` | Zero importers. Was used by `LayoutTest.tsx` but that import was removed in prior cleanup. |

## 2. Dead Hook + Sidebar (2 files)

| File | Evidence |
|---|---|
| `src/hooks/use-mobile.tsx` | Only imported by `sidebar.tsx`, which itself has zero importers. |
| `src/components/ui/sidebar.tsx` | Zero importers in any application code. |

## 3. Dead Exports in `src/lib/imageUtils.ts` (edit)

Remove 3 functions that have zero callers outside the file:
- `getCroppedImageDataUrl` (lines 21-50)
- `blobToDataUrl` (lines 53-64)
- `dataUrlToBase64` (lines 66-77)

Keep: `generateId`, `loadImage`, `getImageDimensions`, `createDisplayPreview`.

## 4. Dead Export in `src/lib/v3/utils.ts` (edit)

Remove `regionArea` function -- a `width * height` wrapper with zero callers.

Update file header docstring from "V3 Layout Utilities" to "Layout Utilities -- Shared math functions for the layout engine."

## 5. Unused Shadcn UI Components (28 files)

Each verified to have zero importers in any live application file (some only imported by other dead files like `sidebar.tsx`):

| File | Why it's dead |
|---|---|
| `accordion.tsx` | Zero importers |
| `alert.tsx` | Zero importers |
| `alert-dialog.tsx` | Zero importers |
| `aspect-ratio.tsx` | Zero importers |
| `avatar.tsx` | Zero importers |
| `breadcrumb.tsx` | Zero importers |
| `calendar.tsx` | Zero importers |
| `carousel.tsx` | Zero importers |
| `chart.tsx` | Zero importers |
| `collapsible.tsx` | Only imported by dead `V3TuningSection.tsx` |
| `command.tsx` | Zero importers |
| `context-menu.tsx` | Zero importers |
| `drawer.tsx` | Zero importers |
| `dropdown-menu.tsx` | Zero importers |
| `form.tsx` | Zero importers |
| `input.tsx` | Only imported by dead `V3TuningSection.tsx` and dead `sidebar.tsx` |
| `input-otp.tsx` | Zero importers |
| `menubar.tsx` | Zero importers |
| `navigation-menu.tsx` | Zero importers |
| `pagination.tsx` | Zero importers |
| `popover.tsx` | Zero importers |
| `radio-group.tsx` | Zero importers |
| `resizable.tsx` | Zero importers |
| `separator.tsx` | Only imported by dead `sidebar.tsx` |
| `sheet.tsx` | Only imported by dead `sidebar.tsx` |
| `table.tsx` | Zero importers |
| `tabs.tsx` | Zero importers |
| `toast.tsx` | Zero importers |
| `toggle.tsx` | Only imported by dead `toggle-group.tsx` |
| `toggle-group.tsx` | Zero importers |

Note: the following UI components are **kept** because they have live importers:
- `button.tsx` (17 files)
- `badge.tsx` (4 files)
- `card.tsx` (HeroFractionRating)
- `checkbox.tsx` (TagCheckboxes)
- `dialog.tsx` (CropEditor)
- `hover-card.tsx` (DebugLogPanel)
- `label.tsx` (CropEditor, TagCheckboxes)
- `progress.tsx` (HeroFractionRating, LayoutRating)
- `scroll-area.tsx` (ThumbnailNavigator, DebugLogPanel)
- `select.tsx` (LayoutTest, HeroFractionRating)
- `skeleton.tsx` (ThumbnailNavigator)
- `slider.tsx` (CollageSettings)
- `switch.tsx` (CropEditor)
- `textarea.tsx` (HeroFractionRating)
- `tooltip.tsx` (App.tsx)

## Summary

| Action | Count | Lines removed (approx) |
|---|---|---|
| Delete application components | 3 | ~260 |
| Delete hook + sidebar | 2 | ~730 |
| Delete UI boilerplate | 28 | ~3,000 |
| Edit `imageUtils.ts` | 1 | ~57 |
| Edit `v3/utils.ts` | 1 | ~8 |
| **Total** | **35 files deleted, 2 edited** | **~4,050 lines** |

All 28 UI components can be re-added in seconds via `npx shadcn-ui@latest add [component]` if ever needed.

