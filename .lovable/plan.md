

# Plan: Add Search Space Values to Prominence Rejection

## What We're Changing

Add `besideCount` (with photo count range) and `besideRowCount` (with row count range) to the "prominence too low" rejection details.

## Current State (from screenshot)

```
REJECTED: prominence too low
ratio: 0.54
required: 1.3
```

## After Change

```
REJECTED: prominence too low
ratio: 0.54
required: 1.3
besideCount: 8 (0-15)
besideRowCount: 4 (2-6)
```

## File to Modify

| File | Changes |
|------|---------|
| `src/lib/v3/region-search.ts` | Update 2 prominence rejection points to include both ranges correctly |

## Changes

### Line ~200 (prominence too low, no BESIDE)
```typescript
details: { 
  prominenceRatio: +prominenceRatioNoAside.toFixed(2), 
  required: tuning.hero_minProminence, 
  besideCount: `0 (${minBeside}-${maxBeside})`,
  besideRowCount: `0`,  // No row range when besideCount=0
},
```

### Line ~310 (prominence too low, with BESIDE)
```typescript
details: { 
  prominenceRatio: +prominenceRatio.toFixed(2), 
  required: tuning.hero_minProminence, 
  besideCount: `${besideCount} (${minBeside}-${maxBeside})`,
  besideRowCount: `${besideRowCount} (${minRows}-${maxRows})`,  // Use actual row range
},
```

## Also Fix: Correct the besideRowCount Range

The last edit incorrectly used `minBeside-maxBeside` for `besideRowCount`. This should use `minRows-maxRows` (the row count range calculated on line ~227). I'll fix this in both canvas AR rejections too:

### Line ~283 (canvas AR rejection, with BESIDE)
```typescript
besideRowCount: `${besideRowCount} (${minRows}-${maxRows})`,  // Fix: use row range, not photo range
```

## Expected Result

All prominence rejections will show the full search context:
- Which `besideCount` was tried and what range was explored
- Which `besideRowCount` was tried and what row range was valid

This helps diagnose whether prominence failures are happening at the edges of the search space or in the middle.

