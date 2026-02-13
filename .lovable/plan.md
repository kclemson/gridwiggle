

# Reduce PNG Export Scale to 1x

## What Changes

Downloaded collage PNGs will be smaller -- roughly 1000px wide instead of ~2000-4000px. This makes files lighter and faster to share. We can always bump it back up if the quality isn't sufficient.

## Change

**File:** `src/lib/exportCollage.ts`

In the `exportCollageAsPng` function, change the default `scale` parameter from `2` to `1`:

```
scale: number = 2  -->  scale: number = 1
```

Single line change, line ~10.

