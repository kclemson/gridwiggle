

# Remove Rounded Corners from Photo Thumbnails

## Issue
Photo thumbnails in the "PHOTOS" grid have rounded corners (`rounded-lg`), but when placed in the actual collage, photos have sharp/square edges. This creates a visual inconsistency - what you see in the thumbnail doesn't match what you get in the final collage.

## Solution
Remove the `rounded-lg` class from the `PhotoThumbnail` component so thumbnails accurately represent how photos will appear in the collage.

## Change

**File: `src/components/PhotoThumbnail.tsx`**

Line 39 - Remove `rounded-lg` from the className:

```typescript
// Before
className={cn(
  "relative group rounded-lg overflow-hidden bg-surface-elevated shrink-0",
  ...
)}

// After
className={cn(
  "relative group overflow-hidden bg-surface-elevated shrink-0",
  ...
)}
```

## Result
- Thumbnails will have sharp/square edges matching the collage output
- WYSIWYG principle maintained - thumbnails look exactly like the final collage cells
- `overflow-hidden` is kept to ensure content stays within bounds

