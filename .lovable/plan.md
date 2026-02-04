

# Add Debug Logging for All Smart Crop Results

## Goal

Log detection results for **every** photo (not just skipped ones) so we can see the actual confidence scores DETR returns for the cartoon images.

## Change

**File: `src/pages/Index.tsx`** (lines 137-139)

Move the console.log outside the `if (result.skipCrop)` block so it logs for all photos:

**Current code:**
```typescript
if (result.skipCrop) {
  console.log(`Skipping smart crop for ${photo.id}: low confidence (${result.confidence.toFixed(2)}), subjects: ${result.subjects}`);
}
```

**New code:**
```typescript
console.log(
  `Smart crop for ${photo.id}: confidence=${result.confidence.toFixed(2)}, ` +
  `subjects="${result.subjects}", skipCrop=${result.skipCrop}`
);
```

## Expected Console Output

After this change, uploading the 4 test images will show:
```
Smart crop for abc123: confidence=0.85, subjects="person", skipCrop=false
Smart crop for def456: confidence=0.63, subjects="person", skipCrop=false  ← Shrek?
Smart crop for ghi789: confidence=0.00, subjects="No subjects detected", skipCrop=true
Smart crop for jkl012: confidence=0.58, subjects="vase", skipCrop=true
```

This will reveal the actual confidence values for Shrek and the pineapple house, helping us pick the right threshold.

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Log all detection results, not just skipped ones |

