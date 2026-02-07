
# UI Improvements: Progress Simplification, Image Optimization, Collapsible Carousel

## Overview

Three improvements to enhance performance and reduce visual clutter:

1. **Simplify progress display** - Remove redundant progress bar and counter
2. **Optimize image loading** - Create display-resolution previews to avoid loading full-res images
3. **Add collapsible carousel** - Auto-collapse after processing to maximize collage space

---

## 1. Simplify Progress Display

### What Changes
Remove the purple progress bar and "X of Y photos processed" text from the processing view. The colored dots already communicate the same information more elegantly.

### User Outcome
A cleaner processing interface that doesn't repeat information. Users see the animated purple dot (currently processing), green dots (complete), and gray dots (pending).

### Technical Changes

**File**: `src/components/PhotoProcessingView.tsx`

Remove:
- The "X of Y photos processed" paragraph
- The `<Progress>` bar component
- The status text ("Loading image...")
- Keep: header, current photo thumbnail, stats, and dots

---

## 2. Display-Resolution Image Previews

### Current Problem
Every `<img>` tag uses `photo.objectUrl`, which points to the full-resolution blob. When a user uploads 50 photos at 4000×3000 (12MP each), the browser is asked to decode and render 600MP+ of image data for the 180px carousel thumbnails.

### Solution
Create a "display preview" version of each image when first loaded:
- Scale down to max ~1200px on longest edge (sufficient for crop editor and collage preview)
- Store as a separate `previewUrl` alongside the original blob
- Use `previewUrl` for all rendering; reserve original blob for export only

### User Outcome
- Faster photo loading and smoother UI
- Less memory pressure (fewer browser crashes/slowdowns)
- Same export quality (full-res used for download)

### Technical Changes

**File**: `src/types/collage.ts`
- Add `previewBlob?: Blob` and `previewUrl?: string` to `PhotoItem`

**File**: `src/lib/imageUtils.ts`
- Add `createDisplayPreview(blob: Blob, maxSize: number): Promise<{blob: Blob, url: string}>`
- Uses OffscreenCanvas (or fallback canvas) to scale image down

**File**: `src/components/PhotoUploader.tsx`
- After getting dimensions, call `createDisplayPreview()` to generate preview
- Set both `objectUrl` (original) and `previewUrl` (scaled) on the PhotoItem

**File**: `src/components/common/CroppedImage.tsx`
- Accept optional `previewSrc` prop, fallback to `src` if not provided
- Collage and carousel pass `photo.previewUrl ?? photo.objectUrl`

**File**: `src/components/CropEditor.tsx`
- Use `photo.previewUrl ?? photo.objectUrl` for the SVG image
- Crop coordinates still work because they're in original-pixel space (viewBox handles the mapping)

**File**: `src/lib/exportCollage.ts`
- Continue using `photo.blob` (original full-res) for export

---

## 3. Collapsible Carousel with Auto-Collapse

### User Outcome
After all photos finish processing, the carousel automatically collapses to give more screen space to the collage. Users can expand it if they want to use the carousel navigation.

### Design
- Use Radix Collapsible component (already installed via shadcn)
- Collapsed state shows just a header bar: "Photos (55)" with a chevron
- Expanded state shows the full carousel
- Auto-collapses 500ms after processing completes (smooth transition)
- Persist open/closed state in localStorage

### Technical Changes

**File**: `src/pages/Index.tsx`
- Add `carouselOpen` state, initialized from localStorage
- Watch for transition from `isProcessing=true` → `false`, then set `carouselOpen=false` after delay
- Wrap `PhotoCarousel` in Collapsible component

```text
┌─────────────────────────────────────────────┐
│  Photos (55)                           ▼    │  ← Click to expand
├─────────────────────────────────────────────┤
│  [Collapsed: shows nothing below header]    │
└─────────────────────────────────────────────┘

OR when expanded:

┌─────────────────────────────────────────────┐
│  Photos (55)                           ▲    │  ← Click to collapse
├─────────────────────────────────────────────┤
│  [Full carousel with photo + buttons]       │
│  ← prev    [photo preview]    next →        │
│  [Hero] [Edit] [Delete] [View All]          │
└─────────────────────────────────────────────┘
```

---

## Implementation Sequence

1. **Progress simplification** (quick win)
2. **Collapsible carousel** (medium - UI only)
3. **Display previews** (larger - touches multiple files)

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/PhotoProcessingView.tsx` | Remove progress bar and counter |
| `src/types/collage.ts` | Add `previewBlob` and `previewUrl` fields |
| `src/lib/imageUtils.ts` | Add `createDisplayPreview()` function |
| `src/components/PhotoUploader.tsx` | Generate display preview on upload |
| `src/components/common/CroppedImage.tsx` | Accept and prefer preview URL |
| `src/components/CropEditor.tsx` | Use preview URL for rendering |
| `src/components/CollagePreview.tsx` | Pass preview URL to CroppedImage |
| `src/components/PhotoCarousel.tsx` | Pass preview URL to CroppedImage |
| `src/pages/Index.tsx` | Add collapsible carousel with auto-collapse |
