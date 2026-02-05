

# Plan: Remove 'good-variety' Positive Tag

## Summary

Remove the redundant 'good-variety' tag since 'well-balanced' covers the same concept and is what you've been using.

## Changes

### 1. `src/test/layout/types.ts`

Remove 'good-variety' from the `LAYOUT_POSITIVE_TAGS` array:

**Before:**
```typescript
export const LAYOUT_POSITIVE_TAGS = [
  'well-balanced',
  'hero-works',
  'good-variety',
] as const;
```

**After:**
```typescript
export const LAYOUT_POSITIVE_TAGS = [
  'well-balanced',
  'hero-works',
] as const;
```

### 2. `src/components/layout-rating/TagCheckboxes.tsx`

Remove the 'good-variety' entry from `TAG_LABELS`:

**Before:**
```typescript
const TAG_LABELS: Record<LayoutTag, string> = {
  // ... issue tags ...
  'well-balanced': 'Well balanced',
  'hero-works': 'Hero works well',
  'good-variety': 'Good variety',
};
```

**After:**
```typescript
const TAG_LABELS: Record<LayoutTag, string> = {
  // ... issue tags ...
  'well-balanced': 'Well balanced',
  'hero-works': 'Hero works well',
};
```

## Note

Existing ratings in localStorage that have the 'good-variety' tag will still be preserved in the data - they just won't be selectable for new ratings. This is fine for historical data integrity.

