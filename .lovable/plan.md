
# Add Prominent Spinner Feedback During Collage Generation

## The Problem

When you click the refresh button, the canvas dims (opacity drops to 60%) and the tiny RefreshCw icon technically spins - but the generation is so fast (~10-50ms) and the icon so small (16px) that you don't perceive any spinner. The dimming alone feels like lag rather than intentional "working" feedback.

## What Changes For You

After this fix:
- A **centered spinner overlay** appears on the dimmed canvas during generation
- More obvious visual signal that work is happening
- Matches the loading pattern used elsewhere in the app (photo processing, initial load)

## Technical Changes

### File: `src/pages/Index.tsx`

Add a centered `Loader2` spinner overlay inside the collage container when generating:

```text
Current (lines 598-630):
<div className={cn(
  "relative overflow-hidden transition-opacity duration-150",
  isGenerating && "opacity-60"
)}>
  <CollagePreview ... />
  {/* Error overlay */}
</div>

After:
<div className={cn(
  "relative overflow-hidden transition-opacity duration-150",
  isGenerating && "opacity-60"
)}>
  <CollagePreview ... />
  
  {/* Generating overlay - spinner centered on canvas */}
  {isGenerating && (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )}
  
  {/* Error overlay */}
</div>
```

This adds a prominent 32px spinning loader centered over the dimmed canvas, matching the pattern used in `PhotoThumbnail.tsx` for processing photos.

## Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `Loader2` spinner overlay inside collage container when `isGenerating` is true |

This is a 5-line addition that provides the prominent visual feedback you're expecting.
