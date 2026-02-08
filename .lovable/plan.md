

# Left-Align Thumbnails and Reduce Edge Gaps

## Problem Summary

Looking at the screenshots, two issues:
1. Thumbnails are centered within each row, leaving awkward centered gaps (especially visible in the mobile screenshot where the last photo is centered alone)
2. The container has extra padding (`p-4` on ScrollArea + `p-2` on inner div) that wastes horizontal space on mobile

---

## Design Intent

**What behavior do we want?**
- Thumbnails flow left-to-right, aligned to the left edge
- Rows fill available width before wrapping
- Minimal edge padding so thumbnails use maximum available width

**What will users experience?**
- Cleaner, more predictable layout - photos always start from the left
- More thumbnails visible per row on mobile (less wasted space)

---

## Implementation Details

### File: `src/components/ThumbnailNavigator.tsx`

**Change 1: Remove `justify-center` from flex container**

```tsx
// Line 107 - Before
<div className="flex flex-wrap gap-3 justify-center p-2">

// After - left align, reduce inner padding
<div className="flex flex-wrap gap-2 justify-start">
```

**Change 2: Reduce ScrollArea padding**

```tsx
// Line 106 - Before
<ScrollArea className="flex-1 p-4">

// After - tighter padding (p-3 instead of p-4)
<ScrollArea className="flex-1 p-3">
```

**Change 3: Reduce gap between thumbnails**

Change from `gap-3` (12px) to `gap-2` (8px) to fit more thumbnails per row.

---

## Visual Comparison

**Before (centered, wide gaps):**
```
│                                        │
│     ┌───┐ ┌─────┐ ┌──┐ ┌────┐         │  ← centered, gaps on edges
│     │   │ │     │ │  │ │    │         │
│     └───┘ └─────┘ └──┘ └────┘         │
│              ┌────┐                    │  ← single item centered
│              │    │                    │
│              └────┘                    │
│                                        │
```

**After (left-aligned, tighter):**
```
│                                        │
│ ┌───┐ ┌─────┐ ┌──┐ ┌────┐ ┌───┐       │  ← left aligned, more fit
│ │   │ │     │ │  │ │    │ │   │       │
│ └───┘ └─────┘ └──┘ └────┘ └───┘       │
│ ┌────┐                                 │  ← single item left-aligned
│ │    │                                 │
│ └────┘                                 │
│                                        │
```

---

## Summary of Changes

| Location | Before | After |
|----------|--------|-------|
| Line 106 | `p-4` | `p-3` |
| Line 107 | `gap-3 justify-center p-2` | `gap-2 justify-start` |

