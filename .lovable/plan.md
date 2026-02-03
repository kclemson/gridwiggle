

## Fix: CropEditor Layout - Make Dialog Size to Content

### Problem
The current layout forces the dialog to be exactly `h-[90vh]` tall, and `flex-1` on the canvas container makes it expand to fill that space. For wide/landscape images, this creates massive empty black areas above and below the image.

### Root Cause
```
Current: h-[90vh] + flex-1 = container always 90vh, image floats in middle
Desired: max-h-[90vh] + no flex-1 = container sizes to image, capped at 90vh
```

### Solution
Change the layout so the **image determines the dialog height** (up to a maximum), rather than the dialog forcing a fixed height.

---

### Changes to `src/components/CropEditor.tsx`

#### 1. DialogContent (line 150)
Change from fixed height to max height:
```tsx
// FROM:
className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"

// TO:
className="max-w-4xl w-full max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
```

#### 2. Canvas container (line 158)
Remove `flex-1` so it doesn't expand, and constrain the SVG height:
```tsx
// FROM:
<div className="flex-1 min-h-0 overflow-hidden bg-black/50 flex items-center justify-center p-4">
  <svg
    ...
    className="max-w-full max-h-full block touch-none select-none"

// TO:
<div className="overflow-hidden bg-black/50 flex items-center justify-center p-4">
  <svg
    ...
    className="max-w-full block touch-none select-none"
    style={{ maxHeight: 'calc(90vh - 120px)' }}
```

The `calc(90vh - 120px)` accounts for header (~48px) + footer (~48px) + padding (~24px).

---

### How This Works

**Before (forced 90vh):**
```text
┌─────────────────────────────────┐ ← h-[90vh] forces this height
│ Header                          │
├─────────────────────────────────┤
│                                 │
│         (empty space)           │  ← flex-1 expands
│                                 │
│      ┌─────────────────┐        │
│      │   Wide Image    │        │  ← SVG fits within expanded container
│      └─────────────────┘        │
│                                 │
│         (empty space)           │
│                                 │
├─────────────────────────────────┤
│ Footer                          │
└─────────────────────────────────┘
```

**After (content-sized):**
```text
┌─────────────────────────────────┐
│ Header                          │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │ ← Container sizes to image
│ │       Wide Image            │ │
│ └─────────────────────────────┘ │
├─────────────────────────────────┤
│ Footer                          │
└─────────────────────────────────┘ ← Dialog height = content height
```

---

### Edge Cases

1. **Very tall images**: The `maxHeight: calc(90vh - 120px)` on the SVG prevents the dialog from exceeding 90vh
2. **Very wide images**: Image will be width-constrained, dialog will be short (header + small image + footer)
3. **Mobile**: Same behavior - dialog sizes to content, capped at 90vh

---

### Summary of Changes

| Element | Current | New |
|---------|---------|-----|
| DialogContent | `h-[90vh]` | `max-h-[90vh]` |
| Canvas container | `flex-1 min-h-0` | (remove flex-1) |
| SVG | `max-h-full` | `style={{ maxHeight: 'calc(90vh - 120px)' }}` |

