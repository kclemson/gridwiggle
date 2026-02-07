# Fix Gap Slider Stability + Error Overlay

## Status: ✅ Implemented

## Changes Made

### 1. Threaded `randomize` flag through V3 engine
All randomness is now gated behind the `randomize` flag:

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Added `randomize` param to `findValidConfiguration`, `evaluateNormalizedProposal`, and `scoreConfiguration`. Tiebreaker only applied when `randomize=true`. |
| `src/lib/v3/split-search.ts` | Added `randomize` param to `findBestSplit`. When `false`: sorts photos by AR (deterministic) and picks best-scored split. When `true`: shuffles and picks randomly. |
| `src/lib/v3/utils.ts` | Added `randomize` param to `distributeByARBudget`. Jitter only applied when `randomize=true`. |
| `src/lib/v3/index.ts` | Passes `randomize` to `findValidConfiguration`. |

### 2. Error overlay + layout preservation
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Added `layoutError` state. On generation failure with existing layout: preserves layout and shows overlay. Overlay has "Try Again" button with shuffle. Settings changes clear the error. |

## User Outcomes
1. **Stable slider experience** - Moving Spacing slider produces consistent, predictable changes
2. **Shuffle still works** - Refresh button still provides variety (uses `randomize: true`)
3. **Collage preserved on error** - Last good layout stays visible with overlay message
4. **Configure always accessible** - Can still adjust settings to escape edge cases

## Testing Checklist
1. Upload 5+ photos, generate collage
2. Move Spacing slider back and forth - layout should remain stable
3. Click shuffle button - layout should change (variety)
4. Force a failure (e.g., 2 extreme portrait photos) - previous collage should show with overlay
5. Click "Try Again" on overlay - should attempt with randomize
6. Verify Configure section never disappears while a collage is visible
