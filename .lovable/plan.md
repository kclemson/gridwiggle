

# Plan: Inline BesideCount Range with BesideRowCount

## What We're Changing

Instead of adding a separate `besideRange` field, format the `besideRowCount` value to include the search range inline:

**Before:**
```
besideRowCount: 4
```

**After:**
```
besideRowCount: "4 (0-15)"
```

## File to Modify

| File | Changes |
|------|---------|
| `src/lib/v3/region-search.ts` | Update 4 rejection points to format `besideRowCount` with range |

## Changes

### Line ~180 (canvas AR rejection, no BESIDE)
```typescript
details: { 
  canvasAR: +canvasAR.toFixed(2), 
  besideCount: 0, 
  besideRowCount: `0 (${minBeside}-${maxBeside})`,  // Include range
  belowRowCount,
},
```

### Line ~203 (prominence too low, no BESIDE)
```typescript
details: { 
  prominenceRatio: +prominenceRatio.toFixed(2), 
  required: tuning.hero_minProminence, 
  besideCount: 0,
  besideRowCount: `0 (${minBeside}-${maxBeside})`,  // Include range
},
```

### Line ~286 (canvas AR rejection, with BESIDE)
```typescript
details: { 
  canvasAR: +canvasAR.toFixed(2), 
  besideCount, 
  besideRowCount: `${besideRowCount} (${minBeside}-${maxBeside})`,  // Include range
  belowRowCount,
},
```

### Line ~313 (prominence too low, with BESIDE)
```typescript
details: { 
  prominenceRatio: +prominenceRatio.toFixed(2), 
  required: tuning.hero_minProminence, 
  besideCount, 
  besideRowCount: `${besideRowCount} (${minBeside}-${maxBeside})`,  // Include range
},
```

## Expected Result

The rejection badge will display:
```
REJECTED: canvas too tall
canvasAR: 0.53
besideCount: 8
besideRowCount: 4 (0-15)
belowRowCount: 3
```

This compact format shows both the actual row count used and the search space explored.

