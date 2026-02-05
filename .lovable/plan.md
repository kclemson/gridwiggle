

# Strengthen the Min/Row Penalty

## Goal

Make the `minPhotosPerRow` setting actually enforce denser rows by increasing the penalty weight from `0.5` to `5.0`.

## Current Behavior

With `minPhotosPerRow=6` and a content section of 11 photos, the algorithm produces 3 rows of 3-4 photos because the sparse penalty (0.5 per photo deficit) is too weak compared to aspect ratio penalties.

## Proposed Change

In `src/lib/collageLayout.ts`, line 195-197, change:

```typescript
// BEFORE (weak penalty)
const sparsePenalty = minRowSize < minPhotosPerRow 
  ? 0.5 * (minPhotosPerRow - minRowSize) 
  : 0;

// AFTER (strong penalty)
const sparsePenalty = minRowSize < minPhotosPerRow 
  ? 5.0 * (minPhotosPerRow - minRowSize) 
  : 0;
```

## Expected Result

With 11 photos and `minPhotosPerRow=6`:
- Algorithm will strongly prefer 2 rows (6+5) over 3 rows (4+4+3)
- The last row may still have fewer than 6 if photo count doesn't divide evenly
- Penalty of 15 for 3-photo rows will outweigh aspect ratio concerns

## File to Modify

1. `src/lib/collageLayout.ts` - Change penalty multiplier from `0.5` to `5.0` on line 196

