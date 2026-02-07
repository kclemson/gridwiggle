

# Replace V1 Tuning UI with V3 Tuning Controls

## Overview

Remove the V1-specific tuning controls from the debug panel UI and replace them with V3 tuning parameters. The V1 algorithm code stays intact for now (will be removed separately), but the debug UI becomes V3-focused.

## Design Intent

**Problem**: The current tuning section shows 11+ V1 parameters (maxBeside1Row, heroMinFraction, scaleToleranceLow, etc.) that don't apply to the V3 algorithm, creating confusion when testing V3.

**Goal**: Show only V3-relevant tuning parameters that directly control the new algorithm's behavior.

**User Experience**: A cleaner debug panel with 6-8 V3 parameters that have clear, understandable effects on layout generation.

---

## V3 Tuning Parameters to Expose

| Parameter | Label | Range | Default | Description |
|-----------|-------|-------|---------|-------------|
| `hero_targetProminence` | Target Prominence | 1.0-3.0 | 1.5 | How much bigger hero should be vs content |
| `hero_minProminence` | Min Prominence | 1.0-2.0 | 1.3 | Floor for layout rejection |
| `canvas_minAR` | Min Canvas AR | 0.3-1.0 | 0.67 | Most portrait allowed |
| `canvas_maxAR` | Max Canvas AR | 1.0-3.0 | 2.0 | Most landscape allowed |
| `row_arBudgetJitter` | Row Jitter | 0-0.5 | 0.2 | Organic variation in row sizes |
| `row_maxHeightRatio` | Max Row Height | 1.2-3.0 | 1.8 | Prevents tall singleton rows |

---

## Technical Changes

### 1. Create `src/components/V3TuningSection.tsx` (new file)

New component showing V3-specific controls using the same input style as the old TuningSection:

```typescript
interface V3TuningSectionProps {
  tuning: V3Tuning;
  onTuningChange: (key: keyof V3Tuning, value: number) => void;
  heroPct: string | null;
}
```

Uses a collapsible layout with 6 inputs for the key V3 parameters.

### 2. Update `src/components/DebugPanel.tsx`

**Remove**:
- Import of `TuningSection`
- Import of `LayoutTuning` from `@/types/collage`
- Props: `tuning: LayoutTuning` and `onTuningChange: (key: keyof LayoutTuning, value: number) => void`

**Add**:
- Import of `V3TuningSection`
- Import of `V3Tuning` from `@/lib/v3/types`
- Props: `v3Tuning: V3Tuning` and `onV3TuningChange: (key: keyof V3Tuning, value: number) => void`

**Replace** the TuningSection usage with V3TuningSection.

### 3. Update `src/pages/Index.tsx`

**Remove**:
- `layoutTuning` state (`useState<LayoutTuning>`)
- `handleTuningChange` callback
- `tuning` prop passed to DebugPanel
- `tuning` in `RegenerateOptions` interface
- All V1 tuning-related logic

**Add**:
- `v3Tuning` state: `useState<V3Tuning>(DEFAULT_V3_TUNING)`
- `handleV3TuningChange` callback
- Pass `v3Tuning` to `generateCollageLayoutV3`
- Pass `v3Tuning` and `onV3TuningChange` props to DebugPanel

**Update** the V3 branch in `regenerateCollage`:
```typescript
generateCollageLayoutV3(photosToUse, settings, { 
  photoWeights,
  randomize,
  tuning: v3Tuning,  // Add tuning here
})
```

### 4. Delete `src/components/TuningSection.tsx`

The V1 tuning section is no longer needed since the debug UI is now V3-focused.

---

## Files Summary

| File | Action |
|------|--------|
| `src/components/V3TuningSection.tsx` | **Create** - New V3 tuning controls |
| `src/components/DebugPanel.tsx` | **Modify** - Remove V1 tuning, add V3 tuning |
| `src/pages/Index.tsx` | **Modify** - Replace V1 state with V3 state |
| `src/components/TuningSection.tsx` | **Delete** - No longer needed |

---

## Unchanged

- `src/types/collage.ts` - Keep `LayoutTuning` type for now (V1 algorithm still uses it)
- `src/lib/collageLayout.ts` - V1 algorithm stays intact
- `src/lib/heroLayout.ts` - V1 algorithm stays intact

The V1 algorithm code remains functional for now; only the debug UI is replaced.

