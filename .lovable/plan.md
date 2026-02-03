

## Remove Success Checkmark from Smart Cropped Thumbnails

### Current Behavior
- When a photo is uploaded, it appears in "Original Photos" with a spinner overlay while processing
- Once smart cropping completes, the photo appears in "Smart Cropped" grid with a green checkmark
- The checkmark is meant to indicate "successfully cropped"

### Why the Checkmark is Unnecessary
The fact that a photo appears in the "Smart Cropped" grid at all already indicates success - the grid only shows `photosWithSmartCrop` which filters for `smartCrop || manualCrop`. The checkmark is redundant visual noise.

### Solution
Simply remove the checkmark indicator from `PhotoThumbnail.tsx`. The existing flow already handles the processing state correctly:

1. Photo uploads → shows in "Original Photos" with spinner overlay
2. Smart crop completes → photo appears in "Smart Cropped" grid (no overlay needed)
3. If processing fails → error overlay shows on the original photo

### Technical Change

**File: `src/components/PhotoThumbnail.tsx`**

Remove lines 68-73 (the smart crop success indicator):

```typescript
// DELETE THIS BLOCK:
{/* Smart crop success indicator */}
{showCropped && activeCrop && !photo.isProcessing && (
  <div className="absolute bottom-1 left-1 rounded-full bg-success p-1">
    <Check className="h-3 w-3 text-success-foreground" />
  </div>
)}
```

Also remove the unused `Check` import from lucide-react (line 1).

### Changes Summary

| File | Change |
|------|--------|
| `src/components/PhotoThumbnail.tsx` | Remove `Check` from imports |
| `src/components/PhotoThumbnail.tsx` | Delete the success indicator JSX block (lines 68-73) |

### Result
- Cleaner thumbnail appearance - no green checkmark clutter
- The appearance in the "Smart Cropped" grid is itself the success indicator
- Processing state still shown correctly via spinner overlay on original photo

