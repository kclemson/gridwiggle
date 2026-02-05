

# Plan: Add Photo Count to Shape Banner

## Summary

Move the photo count into the shape indicator banner for better visibility. Change from just "PORTRAIT" to "PORTRAIT (7)".

## Change

### `src/pages/LayoutRating.tsx`

Update line 206 to include the photo count:

**Before:**
```tsx
{currentResult.testCase.shape}
```

**After:**
```tsx
{currentResult.testCase.shape.toUpperCase()} ({currentResult.testCase.photos.length})
```

Note: Adding `.toUpperCase()` since the current CSS uses `uppercase` via Tailwind, but making it explicit in the text ensures consistency and makes the format clearer: `PORTRAIT (7)`.

