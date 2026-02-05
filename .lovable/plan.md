
# Fix: Photos Without Smart Crop Are Unclickable

## Root Cause Found

The issue isn't memory or scale - it's a logic bug in the click handler:

```javascript
onPhotoClick={(photoId) => {
  const photo = state.photos.find(p => p.id === photoId);
  if (photo && (photo.smartCrop || photo.manualCrop)) {  // ← BUG HERE
    setEditingPhotoId(photoId);
  }
}}
```

When smart crop **skips** a photo (no person detected), `smartCrop` is set to `null`. Photos without `smartCrop` AND without `manualCrop` become unclickable - the click handler silently does nothing.

### Why It Affects ~11 of 53 Photos

The vision model only applies smart crop when it detects a "person" (line 143 in visionWorker.ts):
```javascript
const hasPerson = results.some(r => r.score > 0.4 && r.label === 'person');
const skipCrop = !hasPerson;
```

Photos of landscapes, objects, memes, text, or anything without a detected person get `skipCrop: true` → `smartCrop: null` → unclickable.

---

## Solution

Remove the crop-existence check from the click handler. **All photos should be editable** - users may want to manually crop a photo even if smart crop didn't find anything.

**File:** `src/pages/Index.tsx`

```text
Before (lines 350-355):
onPhotoClick={(photoId) => {
  const photo = state.photos.find(p => p.id === photoId);
  if (photo && (photo.smartCrop || photo.manualCrop)) {
    setEditingPhotoId(photoId);
  }
}}

After:
onPhotoClick={(photoId) => {
  const photo = state.photos.find(p => p.id === photoId);
  if (photo && !photo.isProcessing) {
    setEditingPhotoId(photoId);
  }
}}
```

### Why This Works

1. Photos are clickable as long as they're not actively processing
2. Photos without detected subjects can still be manually cropped
3. Photos that errored during processing can still be edited
4. The CropEditor already handles photos without crops gracefully

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Replace crop-existence check with `!photo.isProcessing` |

---

## Verification

After this fix:
- Upload 53+ photos with mixed content (people, landscapes, objects)
- All photos should become clickable once processing completes
- Tapping any photo should open the crop editor
