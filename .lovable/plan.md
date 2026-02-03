

## CropEditor Layout Fix - Header and Buttons Hug the Canvas

### Goal
Make the title row ("Adjust Crop" + close X) and action buttons (Cancel/Save) sit directly above and below the crop canvas, eliminating the excessive empty space.

### Current Layout Issues

```text
┌─────────────────────────────────┐
│  [p-4 padding]                  │
│  ┌───────────────────────────┐  │
│  │ Adjust Crop           [X] │  │  ← DialogHeader
│  └───────────────────────────┘  │
│  [gap-4]                        │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │   ┌─────────────────┐     │  │  ← flex-1 container expands
│  │   │   SVG Canvas    │     │  │     to fill available space
│  │   │   (letterboxed) │     │  │
│  │   └─────────────────┘     │  │
│  │                           │  │
│  └───────────────────────────┘  │
│  [gap-4]                        │
│  ┌───────────────────────────┐  │
│  │      [Cancel] [Save]      │  │  ← DialogFooter
│  └───────────────────────────┘  │
│  [p-4 padding]                  │
└─────────────────────────────────┘
```

### Target Layout

```text
┌─────────────────────────────────┐
│ Adjust Crop              [X]   │  ← Header with border-bottom
├─────────────────────────────────┤
│                                 │
│      ┌─────────────────┐        │  ← Canvas area (flex-1 min-h-0)
│      │   SVG Canvas    │        │     SVG sizes to fit naturally
│      └─────────────────┘        │
│                                 │
├─────────────────────────────────┤
│           [Cancel] [Save Crop] │  ← Footer with border-top
└─────────────────────────────────┘
```

### Changes to `src/components/CropEditor.tsx`

**Line 150 - DialogContent:**
```tsx
// FROM:
<DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-4 gap-4">

// TO:
<DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
```

**Lines 151-156 - DialogHeader:**
```tsx
// FROM:
<DialogHeader>
  <DialogTitle>Adjust Crop</DialogTitle>
  <DialogDescription className="sr-only">
    Drag the crop area to reposition, or drag corners to resize
  </DialogDescription>
</DialogHeader>

// TO:
<DialogHeader className="px-4 py-3 border-b border-border shrink-0">
  <DialogTitle>Adjust Crop</DialogTitle>
  <DialogDescription className="sr-only">
    Drag the crop area to reposition, or drag corners to resize
  </DialogDescription>
</DialogHeader>
```

**Lines 158-274 - Canvas container:**
```tsx
// FROM:
<div className="flex-1 relative overflow-hidden bg-black/50 rounded-lg flex items-center justify-center">
  <svg
    ...
    style={{ maxHeight: 'calc(90vh - 140px)' }}
  >

// TO:
<div className="flex-1 min-h-0 overflow-hidden bg-black/50 flex items-center justify-center p-4">
  <svg
    ...
    className="max-w-full max-h-full block touch-none select-none"
    // Remove the inline maxHeight style - let flexbox handle it
  >
```

**Lines 276-283 - DialogFooter:**
```tsx
// FROM:
<DialogFooter className="flex gap-2">

// TO:
<DialogFooter className="px-4 py-3 border-t border-border shrink-0">
```

### Summary of Class Changes

| Element | Current | New |
|---------|---------|-----|
| DialogContent | `p-4 gap-4` | `p-0 gap-0 overflow-hidden` |
| DialogHeader | (default) | `px-4 py-3 border-b border-border shrink-0` |
| Canvas wrapper | `flex-1 relative overflow-hidden bg-black/50 rounded-lg` | `flex-1 min-h-0 overflow-hidden bg-black/50 p-4` |
| SVG | `w-full h-full` + inline maxHeight | `max-w-full max-h-full` (no inline maxHeight) |
| DialogFooter | `flex gap-2` | `px-4 py-3 border-t border-border shrink-0` |

### Why This Works

1. **`p-0 gap-0`** on DialogContent removes all default spacing so we control it precisely
2. **`shrink-0`** on header/footer prevents them from being compressed
3. **`flex-1 min-h-0`** on the canvas container allows it to shrink properly within the flex layout
4. **`max-w-full max-h-full`** on SVG makes it size naturally to available space
5. **Border separators** visually connect header/footer to canvas
6. **`p-4`** on canvas container provides breathing room around the image itself

### File to Modify

- `src/components/CropEditor.tsx`

