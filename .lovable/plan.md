
# Fix ScrollArea Max-Height for Photo Grid

## The Problem

Radix ScrollArea doesn't respect `max-height` on the Root component. This is a known limitation - the inner Viewport element needs the height constraint directly applied to it.

From the screenshot, you can see all 4 rows of photos are visible and no scrollbar appears, confirming the `max-h-60` isn't being enforced.

## The Fix

**File:** `src/components/PhotoGrid.tsx`

Use Tailwind's data attribute selector to target the viewport directly:

```text
Before:
<ScrollArea className="max-h-60">

After:
<ScrollArea className="[&>[data-radix-scroll-area-viewport]]:max-h-60">
```

This selector `[&>[data-radix-scroll-area-viewport]]` targets the direct child with the `data-radix-scroll-area-viewport` attribute (the Viewport component) and applies the max-height constraint there.

## Why This Works

The Radix ScrollArea structure is:
```
Root (overflow: hidden)
  └── Viewport (this needs the height constraint to scroll)
       └── Your content
  └── ScrollBar
```

When we put `max-h-60` on Root, the Viewport (which has `h-full w-full`) doesn't get constrained because `h-full` only works when the parent has an explicit height, not `max-height`.

By targeting the Viewport directly with `max-h-60`, the content can overflow it and trigger the scrollbar.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/PhotoGrid.tsx` | Change `max-h-60` to `[&>[data-radix-scroll-area-viewport]]:max-h-60` |
