
# Two-Tier Preview System for Collage Performance

## Problem

The collage canvas IS using preview images, but:
1. Current previews are 1200px (needed for the crop editor which shows detailed crops)
2. The collage canvas is typically 400-600px wide, making 1200px previews overkill
3. With 40+ photos, this means ~40 × (1200×800) = ~38 megapixels being decoded for a small canvas
4. Additionally, the touch drag thumbnail uses full-res images, not previews

## User Outcome

After this change:
- Collage shuffling/refresh will be noticeably faster
- Lower memory pressure on mobile devices
- Reduced risk of iOS Safari page reloads due to memory pressure

## Technical Approach

### Add a Second Preview Tier

| Preview Type | Size | Use Case |
|--------------|------|----------|
| `previewUrl` (existing) | 1200px | Crop editor (needs detail) |
| `thumbnailUrl` (new) | 480px | Collage canvas cells |

### Changes Required

#### 1. File: `src/types/collage.ts`

Add new fields to `PhotoItem`:
```typescript
export interface PhotoItem {
  // ... existing fields ...
  previewUrl?: string;        // 1200px - for crop editor
  previewBlob?: Blob;
  thumbnailUrl?: string;      // 480px - for collage canvas (NEW)
  thumbnailBlob?: Blob;       // (NEW)
}
```

#### 2. File: `src/lib/imageUtils.ts`

No changes needed - `createDisplayPreview` already accepts a size parameter.

#### 3. File: `src/pages/Index.tsx`

During photo processing, create both preview sizes:
```typescript
// Create both preview sizes
const [preview, thumbnail] = await Promise.all([
  createDisplayPreview(photo.blob, 1200),  // For crop editor
  createDisplayPreview(photo.blob, 480),   // For collage canvas
]);

updatePhoto(photo.id, {
  originalWidth: width,
  originalHeight: height,
  previewUrl: preview.url,
  previewBlob: preview.blob,
  thumbnailUrl: thumbnail.url,
  thumbnailBlob: thumbnail.blob,
});
```

#### 4. File: `src/components/common/CroppedImage.tsx`

Add new prop for thumbnail preference:
```typescript
interface CroppedImageProps {
  src: string;
  previewSrc?: string;
  thumbnailSrc?: string;      // NEW - smallest preview for collage
  // ... rest unchanged
}

// Use smallest available:
const displaySrc = thumbnailSrc ?? previewSrc ?? src;
```

#### 5. File: `src/components/CollagePreview.tsx`

Pass thumbnail to CroppedImage:
```typescript
<CroppedImage
  src={photo.objectUrl}
  previewSrc={photo.previewUrl}
  thumbnailSrc={photo.thumbnailUrl}  // NEW
  ...
/>
```

Also fix the touch drag preview to use thumbnails:
```typescript
// Line 284: Use thumbnail instead of full-res
<img src={photoMap.get(touchDragId)!.thumbnailUrl ?? photoMap.get(touchDragId)!.objectUrl} ... />
```

### Memory Management

When revoking URLs on cleanup/removal, also revoke `thumbnailUrl` in:
- `useCollageState.ts` - cleanup on unmount and photo removal

## Summary

| File | Change |
|------|--------|
| `src/types/collage.ts` | Add `thumbnailUrl` and `thumbnailBlob` fields |
| `src/pages/Index.tsx` | Generate both 1200px and 480px previews in parallel |
| `src/components/common/CroppedImage.tsx` | Add `thumbnailSrc` prop, prefer it over `previewSrc` |
| `src/components/CollagePreview.tsx` | Pass `thumbnailUrl`, fix touch drag preview |
| `src/hooks/useCollageState.ts` | Revoke `thumbnailUrl` on cleanup |

## Performance Impact

With 40 photos:
- Before: 40 × 1200px = ~960k pixels per image ≈ 38MP total
- After: 40 × 480px = ~154k pixels per image ≈ 6MP total
- **~6× reduction** in pixel data for collage rendering
