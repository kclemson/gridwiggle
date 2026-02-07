

# Fix Spacing Slider: Direct Normalized Gap Control

## The Root Issue

The slider controls `gapSize` (0-100) which gets converted to `pixelGap` (0-32px). But the normalized packing algorithm uses a **hardcoded** `normalizedGap = 0.02` and completely ignores `pixelGap`.

Then a wrong fix tried to add row gaps during pixel conversion, creating double gaps on Y but nothing on X.

## Your Correct Mental Model

The slider should directly control the normalized gap value:
- Slider left (0) → `normalizedGap = 0` (photos touch)
- Slider middle (~50) → `normalizedGap = 0.02` (current default)  
- Slider right (100) → `normalizedGap = 0.04` (maximum spacing)

The pixel gaps emerge naturally when the normalized layout gets scaled to fit the canvas.

---

## Technical Changes

### File 1: `src/lib/v3/index.ts`

**Change line 98**: Convert slider to normalized gap instead of pixel gap

```typescript
// Before:
const pixelGap = Math.round((settings.gapSize / 100) * 32);

// After:
// Map slider (0-100) directly to normalized gap (0 to 0.04)
// Middle of slider (~50) produces ~0.02, matching current default
const normalizedGap = (settings.gapSize / 100) * 0.04;
```

**Change line 127**: Pass normalized gap, not pixel gap

```typescript
// Before:
const config = findValidConfiguration(dimensions, canvasWidth, pixelGap, tuning, randomize);

// After:
const config = findValidConfiguration(dimensions, canvasWidth, normalizedGap, tuning, randomize);
```

### File 2: `src/lib/v3/intersection.ts`

**Change function signature** (~line 42-48): Rename `gap` to `normalizedGap` to clarify it's already normalized

```typescript
export function findValidConfiguration(
  photos: PhotoDimension[],
  canvasWidth: number,
  normalizedGap: number,  // Already in normalized space (0-0.04)
  tuning: V3Tuning = DEFAULT_V3_TUNING,
  randomize: boolean = false
): ScoredConfiguration | null {
```

**Remove hardcoded gaps**: Use the passed-in `normalizedGap` everywhere instead of `0.02`

- Line 128: `const normalizedGapForLayout = 0.02;` → use parameter instead
- Line 496: `const estimatedNormalizedGap = 0.02;` → use parameter instead

**Remove broken pixel-layer offsets** (~lines 549, 556-557):

```typescript
// Line 549 - remove the added row gap:
// Before: y: cell.y * scaleFactor + (rowIndex * gap),
// After:  y: cell.y * scaleFactor,

// Lines 556-557 - remove extra height:
// Before:
const totalGapHeight = (rowCount - 1) * gap;
const actualCanvasHeight = normalizedResult.height * scaleFactor + totalGapHeight;

// After:
const actualCanvasHeight = normalizedResult.height * scaleFactor;
```

**Remove `pixelGap` from `convertToPixels`**: The function currently takes `pixelGap` and adds it at region boundaries. Since gaps are now handled entirely in normalized space, remove all `+ pixelGap` additions and simplify the function signature.

---

## Summary

| Location | Change |
|----------|--------|
| `index.ts` line 98 | `normalizedGap = (gapSize / 100) * 0.04` instead of pixel conversion |
| `index.ts` line 127 | Pass `normalizedGap` to `findValidConfiguration` |
| `intersection.ts` signature | Clarify parameter is already normalized |
| `intersection.ts` ~128, ~496 | Use passed `normalizedGap` instead of hardcoded `0.02` |
| `intersection.ts` ~549 | Remove `+ (rowIndex * gap)` from Y coordinates |
| `intersection.ts` ~556-557 | Remove `totalGapHeight` from canvas height |
| `intersection.ts` `convertToPixels` | Remove all `+ pixelGap` additions |

## Result

- Slider at 0 → photos touch on all sides
- Slider at 50 → ~0.02 normalized gap (current behavior)
- Slider at 100 → 0.04 normalized gap (double current spacing)
- Gaps are uniform in both X and Y (no double-application)

