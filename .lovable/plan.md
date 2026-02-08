
# Increase Default Gap Size

## Problem Summary

The current default gap size of 8 (on a 0-100 slider) produces gaps so thin they're nearly invisible, as shown in your screenshot.

---

## Design Intent

**What behavior do we want?**
- Default gap is visually noticeable without being excessive
- ~2-3x the current width for better visual separation between photos

**What will users experience?**
- New collages start with more visible spacing between photos
- Existing collages retain their saved settings (no disruption)

---

## Technical Analysis

**Current math:**
```
normalizedGap = (gapSize / 100) * 0.04
```

| gapSize | normalizedGap | Visible result |
|---------|---------------|----------------|
| 8 (current) | 0.0032 (0.32%) | Nearly invisible |
| 16 | 0.0064 (0.64%) | 2x current |
| 20 | 0.0080 (0.80%) | 2.5x current |
| 24 | 0.0096 (0.96%) | 3x current |

**Recommendation**: Change default from `8` to `20` (2.5x bigger)

This positions the slider knob near the lower quarter of the range, giving clear visual separation while leaving room to increase or decrease.

---

## Implementation

**File: `src/hooks/useCollageState.ts`**

Single line change at line 32:

```typescript
const defaultSettings: CollageSettings = {
  shape: 'auto',
  gapColor: '#000000',
  gapSize: 20,  // Changed from 8
};
```

---

## File Changes

| File | Change |
|------|--------|
| `src/hooks/useCollageState.ts` | Line 32: `gapSize: 8` → `gapSize: 20` |

---

## Backward Compatibility

- Existing users with saved collages keep their current `gapSize` value (persisted in localStorage)
- Only new collages (or after clearing data) will use the new default
- No migration needed
