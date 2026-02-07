

# Plan: Add Constraint Breakdown to Below Row Count Results

## The Problem

When `belowRowCount` shows a squeezed range like `3 (3-3)`, you can't tell which constraint caused the squeeze:
- **maxRowsByMinAR** (canvas too tall) 
- **minRowsByMaxAR** (canvas too wide)
- **minRowsByCellSize** (cells too small vs hero)

## Solution

Expand `BelowRowCountResult` to include the raw constraint values, then surface them in rejection details.

---

## Technical Changes

| File | Change |
|------|--------|
| `src/lib/v3/normalized-pack.ts` | Expand `BelowRowCountResult` interface; return raw constraint values |
| `src/lib/v3/region-search.ts` | Include constraint breakdown in rejection details |
| `src/lib/v3/intersection.ts` | Include constraint breakdown in rejection details |

---

## Detailed Changes

### 1. Expand BelowRowCountResult (normalized-pack.ts)

```typescript
export interface BelowRowCountResult {
  value: number;
  minRows: number;
  maxRows: number;
  // Raw constraint values for diagnostics
  constraints: {
    maxRowsByMinAR: number;    // Prevents canvas too tall
    minRowsByMaxAR: number;    // Prevents canvas too wide  
    minRowsByCellSize: number; // Prevents tiny cells
    targetWidth: number;       // The width being packed into
  };
}
```

Update `calculateBelowRowCount` return to include these:
```typescript
return { 
  value, 
  minRows, 
  maxRows,
  constraints: {
    maxRowsByMinAR,
    minRowsByMaxAR,
    minRowsByCellSize,
    targetWidth,
  }
};
```

### 2. Update region-search.ts Rejections

Where `belowRowResult` is used, include the constraint breakdown:

```typescript
details: { 
  canvasAR: +canvasAR.toFixed(2), 
  besideCount: 0, 
  besideRowCount: `0 (${minBeside}-${maxBeside})`, 
  belowRowCount: `${belowRowCount} (${belowRowRange})`,
  belowConstraints: belowRowResult.constraints, // NEW
  heroAR: +heroAR.toFixed(2) 
},
```

### 3. Update intersection.ts Rejections

Pass through the constraint details from `belowResult`:

```typescript
// Extract for diagnostics (near line 227)
const belowConstraints = belowResult.constraints;

// In rejection details:
details: { 
  ...existingFields,
  belowConstraints,
},
```

---

## Expected Result

Rejection badges will show:

```text
REJECTED: canvas_too_tall
canvasAR: 0.53
allowed: 0.67 - 2.00
besideCount: 0
besideRowCount: 0
belowRowCount: 3 (3-3)
belowConstraints: {
  maxRowsByMinAR: 2,        ← "I wanted max 2 rows for height"
  minRowsByMaxAR: 3,        ← "I needed min 3 rows for width"
  minRowsByCellSize: 1,     ← "Cell size was fine"
  targetWidth: 1.05
}
heroAR: 1.05
```

Now you can immediately see the conflict: `maxRowsByMinAR: 2` vs `minRowsByMaxAR: 3` — the constraints are mutually exclusive for this configuration.

