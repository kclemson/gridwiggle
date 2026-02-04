

# Add Filename to Smart Crop Logging

## Goal

Include the original filename in the console logs so you can identify which image is which when debugging smart crop detection.

## Current Situation

- `PhotoItem` only has `id` (generated UUID), no filename
- The filename is available in `PhotoUploader` when files are selected (`file.name`)
- But it's not being stored in the photo object

## Changes Required

### File 1: `src/types/collage.ts`

Add optional `filename` field to both `PhotoItem` and `PhotoMetadata`:

```typescript
export interface PhotoItem {
  id: string;
  filename?: string;           // NEW: Original filename for debugging
  objectUrl: string;
  // ... rest unchanged
}

export interface PhotoMetadata {
  id: string;
  filename?: string;           // NEW: Persist for debugging
  // ... rest unchanged
}
```

### File 2: `src/components/PhotoUploader.tsx`

Capture the filename when creating the PhotoItem:

```typescript
return {
  id: generateId(),
  filename: file.name,         // NEW: Store original filename
  objectUrl,
  blob,
  // ... rest unchanged
};
```

### File 3: `src/pages/Index.tsx`

Update the logging to show filename (fallback to ID if not available):

```typescript
console.log(
  `Smart crop for ${photo.filename || photo.id}: confidence=${result.confidence.toFixed(2)}, ` +
  `subjects="${result.subjects}", skipCrop=${result.skipCrop}`
);
```

## Expected Console Output After Fix

```
Smart crop for shrek.jpg: confidence=0.94, subjects="banana", skipCrop=false
Smart crop for lisa-simpson.png: confidence=0.00, subjects="No subjects detected", skipCrop=true
Smart crop for pineapple-house.jpg: confidence=0.96, subjects="banana", skipCrop=false
Smart crop for picard.jpg: confidence=1.00, subjects="person", skipCrop=false
```

## Files Modified

| File | Change |
|------|--------|
| `src/types/collage.ts` | Add optional `filename` field to `PhotoItem` and `PhotoMetadata` |
| `src/components/PhotoUploader.tsx` | Capture `file.name` when creating photo object |
| `src/pages/Index.tsx` | Show filename in log output |

