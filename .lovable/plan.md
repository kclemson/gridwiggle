

# Plan: Fix besideRowCount Mismatch in Rejection Details

## The Problem

The rejection badge shows `besideRowCount: 2 (1-2)` but the visualization clearly shows only **1 row** beside the hero (B and C are side-by-side in a single horizontal row).

## Root Cause

The rejection details use the **loop variable** `besideRowCount` (the requested row count), but the actual packing via `distributeByARBudget` is **greedy** — it may produce fewer rows than requested if the AR budget allows.

| Variable | Value | Meaning |
|----------|-------|---------|
| `besideRowCount` (loop) | 2 | **Requested** rows |
| `besideResult.rowCount` | 1 | **Actual** rows packed |

## The Fix

In `region-search.ts`, change rejection details to show **actual** row count from the pack result:

```typescript
// Before (uses loop variable - the REQUEST)
besideRowCount: `${besideRowCount} (${minRows}-${maxRows})`

// After (uses pack result - the ACTUAL)
besideRowCount: `${besideResult.rowCount} (${minRows}-${maxRows})`
```

---

## Technical Changes

| File | Change |
|------|--------|
| `src/lib/v3/region-search.ts` | Replace `besideRowCount` with `besideResult.rowCount` in all rejection `details` objects |

---

## Affected Lines

Lines ~290 and ~317 in `region-search.ts`:

**Canvas AR rejection** (line 290):
```typescript
details: { 
  canvasAR: +canvasAR.toFixed(2), 
  besideCount: `${besideCount} (${minBeside}-${maxBeside})`, 
  besideRowCount: `${besideResult.rowCount} (${minRows}-${maxRows})`,  // ← Fix
  ...
}
```

**Prominence rejection** (line 317):
```typescript  
details: { 
  prominenceRatio: +prominenceRatio.toFixed(2), 
  required: tuning.hero_minProminence, 
  besideCount: `${besideCount} (${minBeside}-${maxBeside})`, 
  besideRowCount: `${besideResult.rowCount} (${minRows}-${maxRows})`,  // ← Fix
  ...
}
```

---

## Expected Result

After fix, the rejection badge will accurately show:
```
besideRowCount: 1 (1-2)
```

This matches the visualization where B and C are packed into a single row beside the hero.

