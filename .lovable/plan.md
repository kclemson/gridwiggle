
# Plan: Add "Extreme Aspect" Issue Tag

## Purpose

Add a new issue tag to capture layouts where the aspect ratio is excessively tall (portrait) or wide (landscape) - like a portrait collage with 13 rows and a 0.28 aspect ratio when fewer rows would still satisfy the shape constraint.

## Files to Change

### 1. `src/test/layout/types.ts`

Add `'extreme-aspect'` to the `LAYOUT_ISSUE_TAGS` array:

```typescript
export const LAYOUT_ISSUE_TAGS = [
  'hero-not-prominent',
  'hero-too-dominant',
  'single-photo-row',
  'row-too-dense',
  'uneven-sizes',
  'wrong-shape',
  'extreme-aspect',  // NEW: Too tall or too wide for the photo count
  'wasted-space',
] as const;
```

### 2. `src/components/layout-rating/TagCheckboxes.tsx`

Add the label for the new tag in `TAG_LABELS`:

```typescript
const TAG_LABELS: Record<LayoutTag, string> = {
  // ...existing labels...
  'extreme-aspect': 'Extreme aspect',  // NEW
  // ...
};
```

## Result

The new tag will automatically appear in the Issues column of the rating UI (since TagCheckboxes iterates over `LAYOUT_ISSUE_TAGS`), allowing you to tag layouts that are technically the "correct" shape but taken to an unreasonable extreme.

This data will help derive thresholds like:
- Portrait layouts with `canvasAspect < 0.4` should be penalized
- Landscape layouts with `canvasAspect > 2.5` should be penalized
- Row count relative to photo count (e.g., >1.5 rows per photo is excessive)
