

# Fix: Rejection UI Should Check for Ready Photos

## Problem

The rejection UI renders whenever `rejectedLayout` is truthy, but it doesn't verify that photos are actually ready. When you:

1. Clear all photos (or start fresh)
2. Select 20 new photos to upload

The old `rejectedLayout` from the previous session is still in local state, and since `state.layout` is null (cleared), the UI immediately shows the stale rejection overlay — even though "0 of 20 photos ready."

## Solution

Add a simple guard: only show the rejection UI if there are actually **ready photos** (photos with dimensions loaded). If no photos are ready yet, the rejection state is stale and shouldn't be displayed.

## Technical Change

**`src/pages/Index.tsx`** — Line 715

Current:
```tsx
) : rejectedLayout ? (
```

Fixed:
```tsx
) : rejectedLayout && readyPhotos >= 2 ? (
```

Where `readyPhotos` is already computed (or add if not):
```tsx
const readyPhotos = state.photos.filter(p => p.originalWidth > 0).length;
```

## Why This Works

| Scenario | `rejectedLayout` | `readyPhotos` | Shows Rejection UI? |
|----------|------------------|---------------|---------------------|
| Fresh upload (0 ready) | truthy (stale) | 0 | No |
| Mid-upload (5 of 20 ready) | truthy (stale) | 5 | No (< 2 is impossible, but still gated) |
| All photos ready, gen failed | truthy (fresh) | 20 | Yes |
| Clear all, old rejection | truthy (stale) | 0 | No |

The rejection UI now "understands" the collage state: if photos aren't ready, any rejection is stale and shouldn't render.

## Same Fix for `layoutError`

Apply the same guard to the `layoutError` branch (line 759):

Current:
```tsx
) : layoutError ? (
```

Fixed:
```tsx
) : layoutError && readyPhotos >= 2 ? (
```

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `readyPhotos >= 2` guard to rejection and error UI branches |

