
# Add Crop Indicator to Photo Thumbnails

## What Users Will See

In the "View all" grid, photos that have any cropping applied (auto-crop or manual) will show a subtle visual indicator—matching the purple color used in the header for "auto-cropped".

---

## Design Approach

A small corner indicator works well because:
- It's subtle and doesn't obscure the image
- Consistent with the existing hero badge pattern (top-left)
- Uses the same purple (`text-primary`) as the header count

**Proposed indicator**: A small crop icon in the bottom-left corner

```text
┌──────────────┐
│ ⭐           │  ← hero badge (existing, top-left)
│              │
│ 🔲           │  ← crop indicator (new, bottom-left)
└──────────────┘
```

Bottom-left avoids collision with:
- Hero badge (top-left)
- Remove button (top-right)

---

## Technical Changes

### File: `src/components/PhotoThumbnail.tsx`

**Add import**: `Crop` icon from lucide-react

**Add new badge** after the hero badge (around line 74):

```tsx
{/* Crop indicator - shows if photo has any cropping applied */}
{(photo.smartCrop || photo.manualCrop) && (
  <div className="absolute bottom-1 left-1 p-0.5 rounded bg-primary/80 text-white shadow-sm">
    <Crop className="h-2.5 w-2.5" />
  </div>
)}
```

**Design details:**
- `bg-primary/80` - purple background with slight transparency
- `p-0.5` - very small padding for a subtle indicator
- `h-2.5 w-2.5` - tiny icon, smaller than the hero badge
- `bottom-1 left-1` - positioned in bottom-left corner
- `rounded` - slightly rounded corners

---

## Visual Result

**Photo with hero + crop:**
```
┌──────────────┐
│ ⭐           │
│              │
│ 🟣           │  ← small purple crop icon
└──────────────┘
```

**Photo with crop only:**
```
┌──────────────┐
│              │
│              │
│ 🟣           │
└──────────────┘
```

**Photo with no crop:**
```
┌──────────────┐
│              │
│              │
│              │
└──────────────┘
```

---

## Summary

| File | Change |
|------|--------|
| `src/components/PhotoThumbnail.tsx` | Add Crop icon import, add crop indicator badge in bottom-left corner |
