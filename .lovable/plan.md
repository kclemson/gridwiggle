

# Compact Thumbnails with Letterbox/Pillarbox Display

This plan creates a compact, mobile-first layout where thumbnail containers are always square (ensuring 3 per row), but each photo is fully visible within its container using letterboxing/pillarboxing for different aspect ratios.

---

## Visual Behavior

When you upload 3 photos with different orientations:
- **Landscape photo**: Displays with blank space above and below (letterboxed)
- **Square photo**: Fills the entire container perfectly
- **Portrait photo**: Displays with blank space on left and right (pillarboxed)

The blank space will show the container's background color (the dark surface color), creating a uniform grid of square cells.

---

## Changes

### 1. PhotoThumbnail Component

**Current behavior**: Container aspect ratio matches the photo's aspect ratio, causing tall portrait photos to take up lots of vertical space.

**New behavior**: 
- Container is always square (`aspect-square`)
- Photo uses `object-contain` instead of `object-cover`
- Photo is centered within the square container
- For cropped photos: calculate how to fit the cropped region within the square while maintaining its proportions

```text
Key CSS changes:
- Remove dynamic aspectRatio from container style
- Add aspect-square class to container
- Change img to use object-contain and center positioning
- For cropped previews: use flexbox centering to position the crop preview
```

### 2. PhotoGrid Component

**Current**: `grid-cols-2` on mobile with `gap-3`

**New**:
- `grid-cols-3` on mobile for more compact display
- `gap-2` for tighter spacing
- Smaller title text

### 3. Index Page Layout

Reduce vertical spacing throughout:
- Main content: `space-y-4` (from `space-y-8`)
- Container padding: `py-3` (from `py-6`)
- Smaller progress bar area
- Smaller "Create Collage" button

### 4. CollageSettings Component

Make settings more compact:
- Reduce internal padding: `p-3` (from `p-4`)
- Reduce spacing between sections: `space-y-3` (from `space-y-6`)
- Smaller orientation buttons with horizontal layout
- Inline gap color picker

---

## Technical Details

### PhotoThumbnail.tsx Changes

```text
Container:
- Remove: style={{ aspectRatio }}
- Add: className="aspect-square"

For uncropped photos:
- Change: object-cover → object-contain
- Add: centered within the square

For cropped photos:
- Calculate the cropped region's aspect ratio
- Render the cropped portion using object-contain logic
- Center the result within the square container
```

### PhotoGrid.tsx Changes

```text
Grid: grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2
Title: text-xs (from text-sm)
Spacing: space-y-2 (from space-y-3)
```

### Index.tsx Changes

```text
Main container: py-3 space-y-4
Review step sections: space-y-4 (from space-y-8)
Create button: size="default" (from size="lg")
Remove pt-4 from button container
```

### CollageSettings.tsx Changes

```text
Container: space-y-3 p-3 (from space-y-6 p-4)
Orientation buttons: smaller padding (p-2), inline layout
Gap color section: inline with slider on same row for desktop
Slider section: space-y-2 (from space-y-3)
```

---

## Expected Result

On a mobile viewport with 3 photos uploaded:
- Original photos grid: 1 row of 3 small square thumbnails
- Smart cropped grid: 1 row of 3 small square thumbnails  
- Settings: compact horizontal-ish layout
- Create button: visible without scrolling
- Each photo fully visible with appropriate letterboxing/pillarboxing

