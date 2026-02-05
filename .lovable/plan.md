
# Photo Grid Scroll + GridWiggle Branding with Favicon

## Overview

Three focused changes:
1. Cap the photo grid height and add scrolling for large uploads
2. Replace "Smart Collage" with "gridwiggle.com" in the header
3. Use the favicon image instead of the generic Grid3X3 icon

---

## Changes

### 1. Scrollable Photo Grid

**File:** `src/components/PhotoGrid.tsx`

Add a max-height constraint with scroll area when many photos are uploaded.

```text
Before:
<div className="flex flex-wrap gap-2">
  {sortedPhotos.map(...)}
</div>

After:
<ScrollArea className="max-h-60">
  <div className="flex flex-wrap gap-2 pr-2">
    {sortedPhotos.map(...)}
  </div>
</ScrollArea>
```

**Why 240px (`max-h-60`):**
- With 80px thumbnail height + 8px gap, this fits ~2.7 rows
- Users can see enough photos to know they're all there
- Keeps the settings and collage preview visible without scrolling the page

---

### 2. Update Header Branding + Favicon

**File:** `src/pages/Index.tsx`

Replace "Smart Collage" with "gridwiggle.com" and swap the Grid3X3 icon for the favicon:

```text
Before:
import { Grid3X3, ... } from 'lucide-react';

<h1 className="text-lg font-semibold flex items-center gap-2">
  <Grid3X3 className="h-5 w-5 text-primary" />
  Smart Collage
</h1>

After:
// Remove Grid3X3 from imports (still used elsewhere in file)

<h1 className="text-lg font-semibold flex items-center gap-2">
  <img src="/favicon.png" alt="" className="h-5 w-5" />
  gridwiggle.com
</h1>
```

The favicon at `/favicon.png` will serve as the app's visual identity, matching what users see in their browser tab.

---

## Files Summary

| File | Change |
|------|--------|
| `src/components/PhotoGrid.tsx` | Wrap thumbnail grid in ScrollArea with max-h-60 |
| `src/pages/Index.tsx` | Change header to "gridwiggle.com" with favicon image |

---

## Visual Result

| Before | After |
|--------|-------|
| Full page scrolls with 54 photos | Grid area scrolls independently, settings always visible |
| Generic purple Grid3X3 icon | Custom favicon.png |
| "Smart Collage" text | "gridwiggle.com" text |
