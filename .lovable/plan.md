
# Balance Progress Dots Row Wrapping

## The Problem

When progress dots wrap to multiple rows, you can end up with awkward layouts like 27 dots on the first row and 2 dots orphaned on the second row. This looks unbalanced.

## Design Intent

Instead of letting dots wrap naturally (which causes orphaned dots), we'll center-justify the container so partial rows appear centered beneath a full row. This creates visual balance without complex row-balancing logic.

## Technical Changes

### File: `src/components/PhotoProgressDots.tsx`

**Current styling** (line 16):
```tsx
<div className={cn("flex gap-1 flex-wrap", className)}>
```

**New styling**:
```tsx
<div className={cn("flex gap-1 flex-wrap justify-center", className)}>
```

Adding `justify-center` centers the dots, so if the second row has fewer dots, they'll be centered under the first row rather than left-aligned and looking orphaned.

## Visual Result

**Before** (left-aligned wrap):
```
● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●
● ●
```

**After** (centered wrap):
```
● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ● ●
                           ● ●
```

The 2 orphaned dots now appear centered, creating a balanced pyramid-like layout rather than an awkward tail.

## Summary

| File | Change |
|------|--------|
| `src/components/PhotoProgressDots.tsx` | Add `justify-center` to flex container |
