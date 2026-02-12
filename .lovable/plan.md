

# Increase Default Gap Size

## What changes
One line in `src/hooks/useCollageState.ts`: change `gapSize: 20` to `gapSize: 30`.

This moves the default from 20% to 30% on the 0-100 slider, producing slightly wider gaps between photos so the collage doesn't look so tightly packed by default.

## Technical detail
- File: `src/hooks/useCollageState.ts`, line 32
- Change: `gapSize: 20` to `gapSize: 30`
- The slider range is 0-100, mapped to a 0-0.04 normalized gap ratio, so 30 produces a normalized gap of 0.012 (vs 0.008 at 20)

