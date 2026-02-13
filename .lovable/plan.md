

# Fix: Two-Pass Visual Flicker on Mobile Upload

## The Problem

On mobile, the processing pipeline has two sequential phases that both update the "currently processing" indicator, causing the progress dots to cycle through all photos twice:

1. **Preview preparation** (fast, ~80ms/photo): Creates thumbnails and loads dimensions. Updates `currentlyProcessingId` for each photo.
2. **Batch inference** (slow, ~1.7s/photo): Sends to server for smart crop analysis. Updates `currentlyProcessingId` again for each photo.

Users see the highlight zip through all thumbnails quickly, then restart and crawl through them a second time.

## The Fix

Stop updating `currentlyProcessingId` during the preview preparation loop (phase 1). Only update it during the inference phase (phase 2), which is the meaningful progress the user cares about.

## Technical Change

### `src/hooks/useSmartCropProcessing.ts`

Remove the `setCurrentlyProcessingId(photo.id)` call from the preview preparation loop (line 95). The inference callback (line 115) already sets it correctly.

```typescript
// Current (line 94-95):
for (const photo of photosToProcess) {
  setCurrentlyProcessingId(photo.id);  // <-- remove this line
  try {
    const { width, height } = await preparePhoto(photo);
```

One line removed. The progress indicator will only advance as inference results come back, giving users a single smooth pass through the thumbnails.

