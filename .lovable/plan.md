

# Shape Slider: Live AR Reflection + Constraint

## What changes for the user

A "Shape" slider appears in the settings bar between Background and Spacing. It always shows a small morphing outline rectangle that reflects the current collage's aspect ratio. Dragging the slider constrains future generations toward portrait (left), square (center), or landscape (right). After regeneration, the slider snaps to the actual resulting AR -- always truthful.

Clicking **Shuffle** resets the constraint to null (auto variety), but the slider handle still reflects whatever AR the new layout lands on.

The settings row is redesigned as a compact 2-row CSS grid: controls on top, small centered labels below.

## Settings row layout

```text
Row 1:  [Color swatch]  [Indicator + Shape slider]  [Spacing slider]  [S|M|L toggle]
Row 2:   Background            Shape                   Spacing           Size
```

Labels are `text-[10px]`, centered below each control. Spacing slider shrinks from `w-20` to `w-14`.

## Slider-to-AR mapping

| Slider | Target AR | Meaning |
|--------|-----------|---------|
| 0 | 0.55 | Tall portrait |
| 25 | 0.75 | Mild portrait |
| 50 | 1.0 | Square |
| 75 | 1.5 | Mild landscape |
| 100 | 2.0 | Wide landscape |

Bidirectional: `sliderToTargetAR` for engine constraints, `arToSliderPosition` for display. The tolerance window is target x 0.8 to target x 1.2.

## Behavioral rules

- **Default**: `shapeSlider: null` (no constraint, engine uses full range). Slider displays current layout AR.
- **User drags**: Sets `shapeSlider` to a number (0-100). Engine receives AR bounds. After generation, slider snaps to actual result AR.
- **Shuffle**: Resets `shapeSlider` to `null`. Engine runs unconstrained. Slider reflects resulting AR.
- **Other settings changes** (gap, color, size): `shapeSlider` constraint persists if active.

## Technical changes

### 1. `src/types/collage.ts`
- Replace `shape: 'auto' | 'landscape' | 'portrait' | 'square'` with `shapeSlider: number | null` (default `null`)
- Remove `MIN_PHOTOS_FOR_SHAPE`, `MIN_PHOTOS_FOR_SHAPE_CONTROL`, `isShapeAvailable`, and the `MIN_PHOTOS_FOR_SHAPE` constant

### 2. New file: `src/lib/shapeSlider.ts` (~30 lines)
Pure utility with three functions:
- `sliderToTargetAR(position: number): number` -- piecewise linear interpolation across the mapping table
- `sliderToARBounds(position: number | null): { minAR: number; maxAR: number } | null` -- returns null when null, otherwise wraps target in +/-20% tolerance
- `arToSliderPosition(ar: number): number` -- inverse mapping, clamped to 0-100

### 3. New file: `src/components/ShapeIndicator.tsx` (~25 lines)
Takes a slider position (0-100) and renders an outlined rectangle whose aspect ratio matches. Uses constant-area formula (area = 400, width = sqrt(area x ar), height = sqrt(area / ar)). Styled with `border border-muted-foreground/50 rounded-sm`.

### 4. `src/components/CollageSettings.tsx` -- redesign
- Switch from flex to CSS grid: `grid grid-cols-4`, two rows
- Column 1: color swatch / "Background" label
- Column 2: ShapeIndicator + Slider (w-16) / "Shape" label
- Column 3: Spacing slider (w-14, down from w-20) / "Spacing" label
- Column 4: S/M/L toggle / "Size" label
- Labels: `text-[10px] text-muted-foreground text-center`
- New prop: `layout: CollageLayout | null` (to read current AR for display position)
- Slider **displayed value** = `arToSliderPosition(layout.width / layout.height)` when layout exists
- On `onValueChange`: fires `onUpdate({ shapeSlider: value })`

### 5. `src/hooks/useCollageGeneration.ts`
- Import `sliderToARBounds`
- In `regenerateCollage` (around line 79), after destructuring `tuningOverride`, compute AR bounds from `optSettings.shapeSlider`
- If bounds are non-null, merge into tuning: `{ ...tuningOverride, canvas_minAR: bounds.minAR, canvas_maxAR: bounds.maxAR }`
- If null, pass `tuningOverride` unchanged (engine uses its built-in defaults of 0.5-2.25)

### 6. `src/hooks/useCollageState.ts`
- Default settings: `shapeSlider: null` instead of `shape: 'auto'`
- Migration in `loadMetadataFromStorage` (after the existing orientation-to-shape migration): if persisted settings has `shape` field, map `portrait` to 15, `square` to 50, `landscape` to 85, `auto` to null, then delete `shape`

### 7. `src/pages/Index.tsx`
- Pass `layout={state.layout}` to `<CollageSettings>`
- `handleUpdateSettings` (line 205): change `'shape' in updates` to `'shapeSlider' in updates`
- `handleSaveCrop` (lines 117-118): remove the `shape !== 'auto'` check and `updateSettings({ shape: 'auto' })` call
- `handleSaveCrop` (line 124): remove `settings: { ...state.settings, shape: 'auto' }` override
- `handleToggleHero` (lines 134-136): remove `shape` reset logic
- `handleToggleHero` (line 141): remove `settings: { ...state.settings, shape: 'auto' }`
- `handleCreateCollage` (shuffle, line 148-149): reset slider by calling `updateSettings({ shapeSlider: null })` and passing `settings: { ...state.settings, shapeSlider: null }` to `regenerateCollage`

### 8. Other file cleanups
- `src/pages/LayoutRating.tsx` (line 22, 44, 73, 78, 204, 234): Replace `shape` references with `shapeSlider`. Test cases use `shapeSlider: null` for auto and numeric values for constrained shapes
- `src/pages/LayoutTest.tsx` (line 148-149): Change `shape: 'auto'` to `shapeSlider: null`
- `src/test/layout/layoutAdapter.ts` (lines 6, 140, 157-158, 239-256): Remove `isShapeAvailable` import, change `shape` to `shapeSlider: null` in settings objects, simplify `generateTestBatch` to always use `shapeSlider: null` (shape control is now via tuning, not settings enum)
- `src/test/layout/types.ts` (lines 44, 78): Change `shape: CollageSettings['shape']` to `shapeSlider: number | null`

## Verified: What does NOT change

- Layout engine (`src/lib/v4/engine.ts`) -- already supports `canvas_minAR` / `canvas_maxAR` tuning overrides. **Confirmed:** `settings.shape` is never read by the engine or `generateCollageLayoutV4`.
- Worker (`src/workers/layoutWorker.ts`), layout service (`src/services/layoutGenerationService.ts`) -- tuning overrides already flow through cleanly
- No new dependencies

## Risk

Low. The `null` default preserves current behavior entirely. The displayed slider position is always derived from the actual layout (never drifts). The engine already has soft-rejection fallback for tight AR windows. All `shape` references have been audited -- there are no hidden consumers.

