
# UI Adjustments: Carousel Size and Layout

## Overview

Four refinements to the photo carousel and thumbnail navigator components to improve visual balance and layout consistency.

---

## Changes

### 1. Reduce Carousel Photo Size

**Current**: The carousel photo takes full width with `aspect-square`, resulting in a very large image.

**Change**: Reduce to approximately 1/3 of current size by:
- Centering the image container
- Setting a max-width (e.g., `max-w-[200px]` or similar)
- Keeping aspect-square proportions

**File**: `src/components/PhotoCarousel.tsx` (line 107-108)

```text
Before:
<div className="aspect-square bg-muted relative cursor-pointer">

After:
<div className="aspect-square bg-muted relative cursor-pointer max-w-[180px] mx-auto">
```

---

### 2. Update Hero Button Text

**Current**: "Make Hero" / "Hero"

**Change**: "Mark as hero (larger)" / "Hero"

**File**: `src/components/PhotoCarousel.tsx` (line 158)

```text
Before:
{photo.priority === 1 ? 'Hero' : 'Make Hero'}

After:
{photo.priority === 1 ? 'Hero' : 'Mark as hero (larger)'}
```

---

### 3. Move "View All Photos" to Action Row

**Current**: "View All Photos" is on its own row below the action buttons.

**Change**: Add it to the same flex row as Hero/Edit/Delete buttons.

**File**: `src/components/PhotoCarousel.tsx` (lines 144-232)

- Remove the separate View All button at the bottom (lines 224-232)
- Add it inline in the action buttons row (line 144)

```text
<div className="flex justify-center gap-2 mt-3 flex-wrap">
  <Button ... >Mark as hero (larger)</Button>
  <Button ... >Edit</Button>
  <Button ... ><Trash2 /></Button>
  <Button 
    variant="outline"
    size="sm"
    onClick={(e) => {
      e.stopPropagation();
      onViewAll();
    }}
    className="gap-1.5"
  >
    <Grid3X3 className="h-4 w-4" />
    View All
  </Button>
</div>
```

---

### 4. Constrain Navigator Width

**Current**: Full-screen overlay with `fixed inset-0`.

**Change**: Constrain content to `max-w-lg` (512px) centered, matching the main app layout.

**File**: `src/components/ThumbnailNavigator.tsx` (line 77)

```text
Before:
<div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">

After:
<div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex justify-center">
  <div className="flex flex-col w-full max-w-lg">
```

This wraps the content in a centered container with the same max-width as the main app.

---

## Files Summary

| File | Changes |
|------|---------|
| `src/components/PhotoCarousel.tsx` | Reduce image size, update button text, move View All inline |
| `src/components/ThumbnailNavigator.tsx` | Add max-w-lg constraint to content |
