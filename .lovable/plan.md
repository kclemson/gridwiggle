

# Sample Gallery with Rotating Featured Thumbnail

## What Users Will See

Below the "Tap to add photos" upload area, a "See what's possible" section appears with the four sample collages displayed in a grid. One thumbnail is featured at a larger size while the other three sit smaller beside it. Every few seconds, the featured image cycles -- the current large one shrinks back down and another one enlarges to take its place. Tapping any thumbnail opens a full-screen lightbox for detail viewing.

## Design Details

**Thumbnail Layout**
- No rounded corners on any thumbnails (matching the collages themselves)
- One image is "featured" at roughly 2x size, the other three are smaller
- Layout: featured image on the left, 3 smaller thumbnails stacked/gridded on the right (or a responsive arrangement)
- Every 3 seconds, the featured index advances (0 -> 1 -> 2 -> 3 -> 0...), with a smooth scale/opacity transition as images swap roles
- The animation uses CSS transitions on width/height/scale rather than `transition-all` (learning from the earlier performance fix)

**Lightbox (on tap)**
- Full-screen dark overlay using Radix Dialog
- Close button, prev/next navigation arrows
- Escape to close

## Technical Details

### New Files

1. **4 sample PNGs** copied to `src/assets/samples/sample-collage-1.png` through `sample-collage-4.png`

2. **`src/components/SampleGallery.tsx`**
   - `featuredIndex` state, starting at 0, incremented every 3s via `setInterval`
   - Interval clears on unmount (no useEffect sync anti-pattern -- this is a legitimate external timer subscription)
   - Pauses rotation when lightbox is open
   - Layout approach: CSS grid with the featured cell spanning more space
     - Featured cell: `col-span-2 row-span-2` in a 3-column grid, or similar
     - Three non-featured cells fill the remaining slots
   - Transition: each thumbnail gets `transition-transform duration-500` only on the scale property, so the size change animates smoothly without triggering layout thrashing
   - No `rounded` classes on thumbnails -- sharp corners throughout
   - Lightbox: Radix Dialog controlled by `selectedIndex: number | null`

### Modified Files

3. **`src/components/PhotoUploader.tsx`**
   - Import and render `<SampleGallery />` below the upload button in the `hasPhotos === false` branch

### Component Structure

```text
SampleGallery
+-- Heading ("See what's possible")
+-- Grid container (CSS grid, 3 cols)
|   +-- 4 thumbnail buttons, one dynamically gets col-span-2 row-span-2
|   +-- Each: <button> wrapping <img> with object-cover, no rounded corners
|   +-- Featured item transitions scale smoothly
+-- Radix Dialog (controlled by selectedIndex)
    +-- Dark overlay
    +-- Close button
    +-- Full image
    +-- Prev/Next buttons
```

### Animation Approach

Rather than physically reordering DOM elements (which causes layout thrash), all four thumbnails stay in fixed grid positions. The "featured" effect is achieved by having the featured cell span 2 columns and 2 rows while the others span 1 each. The grid rearranges itself naturally via CSS grid, and `transition-transform` handles the visual smoothness. When `featuredIndex` changes, the grid assignments shift, creating the rotating showcase effect.

### Files Modified
- `src/assets/samples/` -- 4 new image files
- `src/components/SampleGallery.tsx` -- new component
- `src/components/PhotoUploader.tsx` -- render SampleGallery in empty state

