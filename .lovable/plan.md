
# Fix Navigation: Return to View All After Crop Editor Cancel

## Problem Summary

Current flow:
1. User clicks "View All" → `navigatorOpen = true`
2. User clicks a photo → `editingPhotoId = photoId` AND `navigatorOpen = false`
3. User clicks "Cancel" in CropEditor → `editingPhotoId = null`
4. Result: Back to main page (navigator is closed)

Expected flow:
- Cancel should return to the View All gallery, not the main page

---

## Design Intent

**What behavior do we want?**
- When opening a photo from View All, keep the navigator "open" in the background
- CropEditor appears on top of the navigator
- Canceling the CropEditor reveals the navigator again

**What will users experience?**
- Natural back-navigation: Cancel returns to where they came from (View All)
- No jarring jump back to the main collage view

---

## Implementation Details

### File: `src/pages/Index.tsx`

**Change: Keep navigator open when selecting a photo (lines 819-822)**

```tsx
// Before (lines 819-822)
onSelect={(photoId) => {
  // Open crop editor directly - View All is for managing crops
  setEditingPhotoId(photoId);
  setNavigatorOpen(false);
}}

// After - don't close navigator when selecting
onSelect={(photoId) => {
  // Open crop editor on top of navigator
  setEditingPhotoId(photoId);
  // Keep navigatorOpen=true so Cancel returns here
}}
```

With this change:
- `navigatorOpen` stays `true` when opening a photo
- CropEditor renders on top (it uses a Dialog with higher z-index)
- When CropEditor closes (Cancel or Save), navigator is still visible

---

## Visual Flow After Fix

```
View All (z-50)     →    CropEditor (Dialog z-50+)    →    View All (z-50)
   open                      on top of navigator              still open
                                   
                            [Cancel] or [Save]
                                    ↓
                           CropEditor closes
                                    ↓
                           Navigator revealed
```

---

## File Changes Summary

| Location | Change |
|----------|--------|
| Lines 819-823 | Remove `setNavigatorOpen(false)` from onSelect handler |
