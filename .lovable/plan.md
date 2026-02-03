

# Fix Three Collage Issues (Preserving Drag-to-Swap)

Keep the interactive `CollagePreview` component for drag-to-swap and tap-to-crop functionality, while fixing the visual and mobile export issues.

---

## Issue #1: Preview Gaps Don't Match Export

**Problem:** CSS percentage positioning creates floating-point rounding differences at different viewport sizes.

**Fix:** Round all cell coordinates and dimensions in `collageLayout.ts` to whole pixels before they're converted to percentages.

### File: `src/lib/collageLayout.ts`

**Lines 163-169** - Round values when creating cells:

```typescript
cells.push({
  photoId: photo.id,
  x: Math.round(x),
  y: Math.round(y),
  width: Math.round(photoWidth),
  height: Math.round(height),
});
```

---

## Issue #2: Background Too Dark

**Problem:** App background is near-black (`3.9%` lightness), same as default gap color.

**Fix:** Change to dark charcoal (`10%` lightness).

### File: `src/index.css`

**Line 9** (light mode) and **Line 56** (dark mode):

```css
/* Change from */
--background: 240 10% 3.9%;

/* Change to */
--background: 240 10% 10%;
```

---

## Issue #3: Mobile Download Experience

**Problem:** File download is awkward on mobile - users want to save directly to Photos.

**Fix:** Use Web Share API on mobile devices, which opens the native share sheet with "Save Image" option.

### File: `src/lib/exportCollage.ts`

Add new function after `downloadBlob`:

```typescript
export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  const shareData = { files: [file] };
  
  // Check if Web Share API with file support is available (mobile browsers)
  if (navigator.canShare && navigator.canShare(shareData)) {
    try {
      await navigator.share(shareData);
      return;
    } catch (err) {
      // User cancelled - that's fine
      if ((err as Error).name === 'AbortError') return;
      // Other error - fall through to download
    }
  }
  
  // Fallback to traditional download (desktop)
  downloadBlob(blob, filename);
}
```

### File: `src/pages/Index.tsx`

**Update import** (line 5):

```typescript
import { exportCollageAsPng, shareOrDownload } from '@/lib/exportCollage';
```

**Update handleExport** (around line 87):

```typescript
// Change from:
downloadBlob(blob, `collage-${timestamp}.png`);

// Change to:
await shareOrDownload(blob, `collage-${timestamp}.png`);
```

---

## How Mobile Share Works

| Platform | Behavior |
|----------|----------|
| iOS Safari | Opens share sheet → "Save Image" saves to Photos |
| Android Chrome | Opens share sheet → "Save to device" or share to apps |
| Desktop | Falls back to file download (current behavior) |

---

## Summary

| Change | File | Purpose |
|--------|------|---------|
| Round cell positions | `collageLayout.ts` | Fix gap inconsistencies |
| Dark charcoal background | `index.css` | Make collage boundaries visible |
| Web Share API | `exportCollage.ts` | Native mobile saving |
| Use shareOrDownload | `Index.tsx` | Call new function |

The drag-to-swap and tap-to-crop features in `CollagePreview` remain unchanged.

