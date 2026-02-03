

# Make "Create Collage" Button Contextual

Transform the button to show "Create Collage" vs "Regenerate Collage" based on whether changes have been made since the last collage was generated.

---

## Current State

Two separate buttons exist:
1. **"Create Collage"** button - always shows this text, visible before layout exists
2. **"Regenerate"** button - separate button inside the collage preview section

The user wants a single contextual button that changes its label based on state.

---

## Detection Logic

The button should show "Regenerate Collage" when a layout exists AND any of these have changed:

| Change Type | How to Detect |
|-------------|---------------|
| Photo crop edited | `manualCrop` changed after layout was created |
| Photo added | Photo count increased |
| Photo removed | Photo count decreased |
| Settings changed | `orientation`, `gapColor`, or `gapSize` changed |

---

## Approach: Track "Layout Stale" State

Rather than complex change detection, we can derive "needs regeneration" by checking if the layout exists. When it does, any edit should signal regeneration is needed.

**Simpler approach:** Track a `layoutVersion` counter in state. When layout is created, snapshot the current state's "version". Any subsequent change (photo edit, settings change, photo add/remove) bumps a version counter. If versions don't match, layout is stale.

**Even simpler:** Just check if `state.layout` exists. If yes, button says "Regenerate". If no, button says "Create". This works because:
- Before first collage: no layout → "Create Collage"
- After creating: layout exists → "Regenerate Collage" (user may want to try different layout)
- After clearing: no layout → back to "Create Collage"

However, the user specifically wants the button to change **when a crop is edited**, implying "I made changes, now regenerate". So we need to track "dirty" state.

---

## Solution: Invalidate Layout on Edit

When photos or settings change, automatically set `layout` to `null`. This way:
- No layout → "Create Collage"  
- Has layout → "Regenerate Collage" (only possible right after generating, before any edits)

**Wait** - this doesn't quite work because we want to keep showing the preview while indicating it's stale.

**Better approach:** Add a `layoutStale` boolean to the component state (not persisted). Set it to `true` when photos/settings change while a layout exists.

---

## Final Design

### State Changes

Add local state in `Index.tsx`:
```typescript
const [layoutStale, setLayoutStale] = useState(false);
```

### Mark Layout as Stale

Update these handlers to set stale when layout exists:

1. **`handleSaveCrop`** - when user edits a crop
2. **`handlePhotosAdded`** - when new photos are added  
3. **`handleRemovePhoto`** - when a photo is removed
4. **`updateSettings`** - when settings change (already wrapped)

### Clear Stale Flag

When `handleCreateCollage` runs, set `layoutStale` to `false`.

### Button Logic

```typescript
const hasLayout = state.layout !== null;
const needsRegenerate = hasLayout && layoutStale;

// Button shows:
// - "Create Collage" when no layout exists
// - "Regenerate Collage" when layout exists AND is stale
// - Keep existing "Regenerate Collage" state when layout exists but not stale (optional)
```

Actually, reconsidering: if a layout exists but isn't stale, do we still show "Create" or "Regenerate"? 

The cleanest UX:
- **No layout**: "Create Collage" (primary action)
- **Has layout, not stale**: Button still says "Regenerate Collage" but maybe dimmed or secondary
- **Has layout, IS stale**: "Regenerate Collage" with emphasis/highlight

Let me simplify further based on the user's request:

---

## Simplified Implementation

### Logic

```typescript
const hasLayout = state.layout !== null;
const buttonLabel = hasLayout ? "Regenerate Collage" : "Create Collage";
const buttonIcon = hasLayout ? RefreshCw : Wand2;
```

This already gets us most of the way - once a collage exists, button changes to "Regenerate". 

To add **emphasis when stale**, we can:
1. Track `layoutStale` boolean
2. Add a visual indicator (different color, animation, or badge)

---

## File Changes

### `src/pages/Index.tsx`

1. **Add state** to track if layout is stale:
   ```typescript
   const [layoutStale, setLayoutStale] = useState(false);
   ```

2. **Update `handleSaveCrop`** to mark stale:
   ```typescript
   const handleSaveCrop = useCallback((photoId: string, crop: CropRegion) => {
     updatePhoto(photoId, { manualCrop: crop });
     setEditingPhotoId(null);
     if (state.layout) setLayoutStale(true);
   }, [updatePhoto, state.layout]);
   ```

3. **Update `handlePhotosAdded`** to mark stale:
   ```typescript
   const handlePhotosAdded = useCallback((newPhotos: PhotoItem[]) => {
     addPhotos(newPhotos);
     processSmartCrops(newPhotos);
     if (state.layout) setLayoutStale(true);
   }, [addPhotos, processSmartCrops, state.layout]);
   ```

4. **Update `handleRemovePhoto`** to mark stale:
   ```typescript
   const handleRemovePhoto = useCallback((photoId: string) => {
     removePhoto(photoId);
     if (state.layout) setLayoutStale(true);
   }, [removePhoto, state.layout]);
   ```

5. **Wrap settings update** to mark stale:
   ```typescript
   const handleUpdateSettings = useCallback((updates: Partial<CollageSettings>) => {
     updateSettings(updates);
     if (state.layout) setLayoutStale(true);
   }, [updateSettings, state.layout]);
   ```
   And pass `handleUpdateSettings` instead of `updateSettings` to `CollageSettings`.

6. **Update `handleCreateCollage`** to clear stale:
   ```typescript
   const handleCreateCollage = useCallback(() => {
     const layout = generateCollageLayout(state.photos, state.settings);
     setLayout(layout);
     setLayoutStale(false);
   }, [state.photos, state.settings, setLayout]);
   ```

7. **Update button rendering**:
   ```typescript
   const hasLayout = state.layout !== null;
   
   <Button
     size="default"
     className={cn("gap-2", layoutStale && "ring-2 ring-primary animate-pulse")}
     disabled={!canCreateCollage}
     onClick={handleCreateCollage}
   >
     {hasLayout ? <RefreshCw className="h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
     {hasLayout ? "Regenerate Collage" : "Create Collage"}
     {isProcessing && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
   </Button>
   ```

8. **Remove separate "Regenerate" button** from the collage preview section (lines 258-266).

---

## Visual Indicator When Stale

When `layoutStale` is true, the button could have:
- A subtle ring/glow effect
- Or simply rely on the label change being obvious enough

I'll add a subtle ring highlight to draw attention.

---

## Summary

| State | Button Text | Visual |
|-------|-------------|--------|
| No layout | "Create Collage" | Normal primary button |
| Has layout, not stale | "Regenerate Collage" | Normal primary button |
| Has layout, IS stale | "Regenerate Collage" | Ring highlight |

