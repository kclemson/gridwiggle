

# Add V3 Toggle to Debug Panel

## Overview

Wire up the V3 layout engine to the debug panel so we can visually test Phase 1 corner placement. This involves upgrading the binary v1/v2 toggle to a 3-way selector.

---

## Changes Required

### 1. Update DebugPanel.tsx

**Current state**: Binary toggle between v1 and v2 using a Switch component

**Changes**:
- Update `AlgorithmVersion` type from `'v1' | 'v2'` to `'v1' | 'v2' | 'v3'`
- Replace the Switch component with a ToggleGroup for 3-way selection (v1 / v2 / v3)
- Style v3 distinctively (perhaps with a different color) to indicate it's experimental

```typescript
export type AlgorithmVersion = 'v1' | 'v2' | 'v3';
```

UI change:
```text
Before: [v1] ◉───────○ [v2]

After:  [ v1 ] [ v2 ] [ v3 ]
         ────   ────   ═════ (v3 highlighted as experimental)
```

### 2. Update Index.tsx

**Changes**:
- Import `generateCollageLayoutV3` from `@/lib/v3`
- Update `regenerateCollage` to handle v3:

```typescript
// In regenerateCollage callback
const layout = 
  algorithmVersion === 'v3'
    ? generateCollageLayoutV3(photosToUse, settings, { photoWeights })
    : algorithmVersion === 'v2'
      ? generateCollageLayoutV2(photosToUse, settings, { photoWeights, randomize })
      : generateCollageLayout(photosToUse, settings, { photoWeights, randomize, tuning });
```

Note: V3 doesn't support `randomize` yet (Phase 1 only has corner placement) - that's fine, we'll add variety in later phases.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/DebugPanel.tsx` | Expand AlgorithmVersion type, replace Switch with ToggleGroup |
| `src/pages/Index.tsx` | Import V3, add v3 case to regenerateCollage |

---

## Implementation Notes

- Uses existing `ToggleGroup` component from `@/components/ui/toggle-group`
- V3 toggle only visible in dev mode (already gated by `import.meta.env.DEV`)
- V3 currently only supports corner placement - if no hero is present or layout fails, it returns null (falls through to existing behavior of showing "Generate Collage" button)
- Dev logs will show `[v3]` category entries for debugging

