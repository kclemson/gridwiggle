

# Consolidate Action Buttons into Single Row

## Problem Summary

Currently, the buttons are split across two locations:
1. **Header** (top right): "Add Photos" + "Clear All"
2. **Below photo strip**: "View All" + optionally "Generate Collage"

This creates visual fragmentation. Users have to look in two places for related actions.

---

## Design Intent

**What behavior do we want?**
- All action buttons live in one place below the photo strip
- Clear visual grouping and logical ordering
- Header becomes cleaner (just the logo)

**What will users experience?**
- Single action row with all relevant buttons
- Intuitive left-to-right flow: primary actions first, destructive action last

---

## Button Ordering Strategy

Considering these buttons and when they appear:

| Button | Appears when |
|--------|--------------|
| View All | Always (when photos exist) |
| Add Photos | Always (when photos exist) |
| Generate Collage | Only when no layout exists (recovery) |
| Clear All | Always (when photos exist) |

**Proposed order (left to right):**

```
[View All] [Add Photos] [Generate Collage*] [Clear All]
           └─ grouped ─┘  └─ conditional ─┘  └─ danger ─┘
```

Rationale:
- **View All** first - primary exploration action
- **Add Photos** second - common additive action
- **Generate Collage** third - only appears when needed (recovery)
- **Clear All** last - destructive action, offset to the right

---

## Implementation Details

### Update PhotoStrip Component

**File: `src/components/PhotoStrip.tsx`**

Add props for onAddPhotos and onClearAll:

```typescript
interface PhotoStripProps {
  photos: PhotoItem[];
  autoCroppedCount: number;
  onViewAll: () => void;
  onAddPhotos: () => void;          // NEW
  onClearAll: () => void;           // NEW
  onGenerate?: () => void;
  showGenerateButton?: boolean;
  isGenerating?: boolean;
}
```

Update the action buttons row:

```tsx
{/* Actions */}
<div className="flex justify-center items-center gap-2">
  <Button variant="outline" size="sm" onClick={onViewAll}>
    <Grid3X3 className="h-4 w-4 mr-1.5" />
    View All
  </Button>
  <Button variant="outline" size="sm" onClick={onAddPhotos}>
    <Plus className="h-4 w-4 mr-1.5" />
    Add Photos
  </Button>
  {showGenerateButton && onGenerate && (
    <Button size="sm" onClick={onGenerate} disabled={isGenerating}>
      {isGenerating ? (
        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
      ) : (
        <Wand2 className="h-4 w-4 mr-1.5" />
      )}
      Generate
    </Button>
  )}
  <Button 
    variant="ghost" 
    size="sm" 
    onClick={onClearAll}
    className="text-destructive hover:text-destructive"
  >
    <Trash2 className="h-4 w-4 mr-1.5" />
    Clear All
  </Button>
</div>
```

### Update Index.tsx

**File: `src/pages/Index.tsx`**

1. **Remove header buttons** - delete the Add Photos and Clear All buttons from the header section (lines 616-632)

2. **Add file input ref** - need a way to trigger file picker from PhotoStrip without the PhotoUploader component

3. **Pass new props to PhotoStrip**:

```tsx
<PhotoStrip
  photos={state.photos}
  autoCroppedCount={state.photos.filter(p => p.smartCrop !== null).length}
  onViewAll={() => setNavigatorOpen(true)}
  onAddPhotos={() => fileInputRef.current?.click()}  // NEW
  onClearAll={clearAll}                               // NEW
  onGenerate={handleCreateCollage}
  showGenerateButton={!state.layout}
  isGenerating={isGenerating}
/>
```

4. **Add hidden file input** - for Add Photos to trigger:

```tsx
<input
  ref={fileInputRef}
  type="file"
  accept="image/*"
  multiple
  onChange={handleFileInputChange}
  className="hidden"
/>
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/components/PhotoStrip.tsx` | Add Add Photos + Clear All buttons to action row |
| `src/pages/Index.tsx` | Remove header buttons, pass callbacks to PhotoStrip, add file input |

---

## Visual Comparison

**Before:**
```
┌────────────────────────────────────────────┐
│ gridwiggle       [+ Add Photos] [Clear All]│  ← header
├────────────────────────────────────────────┤
│ PHOTOS (16) · 16 auto-cropped              │
│ [img][img][img][img][img]...               │
│            [View All]                      │  ← separate row
│ ─────────────────────────────────          │
│ COLLAGE                                    │
└────────────────────────────────────────────┘
```

**After:**
```
┌────────────────────────────────────────────┐
│ gridwiggle                                 │  ← clean header
├────────────────────────────────────────────┤
│ PHOTOS (16) · 16 auto-cropped              │
│ [img][img][img][img][img]...               │
│ [View All][Add Photos]        [Clear All]  │  ← unified row
│ ─────────────────────────────────          │
│ COLLAGE                                    │
└────────────────────────────────────────────┘
```

**With Generate button (no layout):**
```
│ [View All][Add Photos][Generate] [Clear All]│
```

