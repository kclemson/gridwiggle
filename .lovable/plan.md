

# Plan: Rename "Square" to "Square-ish" in UI

## Summary

Change the display label from "Square" to "Square-ish" to set realistic expectations, while keeping the internal value and algorithm unchanged.

## Changes

### 1. `src/components/CollageSettings.tsx`

Update the dropdown option label on line 46:

**Before:**
```tsx
<SelectItem value="square">Square</SelectItem>
```

**After:**
```tsx
<SelectItem value="square">Square-ish</SelectItem>
```

### 2. `src/pages/LayoutRating.tsx`

Update the shape banner display on line 206 to show "SQUARE-ISH" for the rating tool. We'll need to add a display name mapping:

**Before:**
```tsx
{currentResult.testCase.shape.toUpperCase()} ({currentResult.testCase.photos.length})
```

**After:**
```tsx
{(currentResult.testCase.shape === 'square' ? 'SQUARE-ISH' : currentResult.testCase.shape.toUpperCase())} ({currentResult.testCase.photos.length})
```

## What Stays the Same

- Internal value remains `'square'` (no data migration needed)
- Algorithm tolerance stays at ±5%
- All existing ratings in localStorage remain valid

