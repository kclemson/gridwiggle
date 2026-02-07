

## Refactor calculateBelowRowCount + Add Cell Size Constraint

### Design Intent
1. **Clean up API**: Replace individual constraint params with `V3Tuning` object (consistent with rest of v3)
2. **Add cell size constraint**: Integrate `hero_maxToSmallest` so the function picks a row count that satisfies all constraints

### User Outcomes
- Wide heroes with 20+ photos will find valid layouts
- Consistent API across v3 functions
- Easier to add future constraints without signature changes

---

## Changes

### File: `src/lib/v3/normalized-pack.ts`

**Refactor signature and add constraint:**

```typescript
/**
 * Calculate optimal row count for BELOW packing given width and photo geometry.
 * Enforces:
 * - canvas_minAR (prevents too-tall canvas)
 * - canvas_maxAR (prevents too-wide canvas)  
 * - hero_maxToSmallest (prevents tiny content cells)
 */
export function calculateBelowRowCount(
  photos: PhotoDimension[],
  targetWidth: number,
  normalizedGap: number,
  heroAR: number,
  tuning: V3Tuning
): number {
  const n = photos.length;
  if (n <= 1) return 1;
  
  // Photo geometry
  const meanAR = photos.reduce((sum, p) => sum + p.aspectRatio, 0) / n;
  const minAR = Math.min(...photos.map(p => p.aspectRatio));
  
  // === Constraint 1: Prevent too-tall (minAR) ===
  const heroRowHeight = heroAR > 0 ? 1.0 : 0;
  const maxBelowHeight = targetWidth / tuning.canvas_minAR - heroRowHeight - normalizedGap;
  const maxRowsByMinAR = Math.floor(Math.sqrt(Math.max(0, maxBelowHeight * n * meanAR / targetWidth)));
  
  // === Constraint 2: Prevent too-wide (maxAR) ===
  const minRowsByMaxAR = Math.ceil(Math.sqrt(n * meanAR / tuning.canvas_maxAR));
  
  // === Constraint 3: Prevent tiny cells (hero_maxToSmallest) ===
  // Only applies when there's a hero
  let minRowsByCellSize = 1;
  if (heroAR > 0) {
    // Conservative estimate: use 0.6x minAR to account for distribution variance
    const effectiveMinAR = minAR * 0.6;
    minRowsByCellSize = Math.ceil(
      Math.sqrt(heroAR * n * n * meanAR * meanAR / 
        (effectiveMinAR * targetWidth * targetWidth * tuning.hero_maxToSmallest))
    );
  }
  
  // === Combine constraints ===
  const minRows = Math.max(1, minRowsByMaxAR, minRowsByCellSize);
  const maxRows = Math.max(minRows, Math.min(n, maxRowsByMinAR, Math.ceil(n / 2)));
  
  // Choose middle of valid range for balance
  return Math.max(minRows, Math.min(maxRows, Math.ceil((minRows + maxRows) / 2)));
}
```

### File: `src/lib/v3/region-search.ts`

**Update call site (~line 195):**

```typescript
// Before:
const belowRowCount = calculateBelowRowCount(
  belowPhotos,
  heroRowWidth,
  normalizedGap,
  tuning.canvas_minAR,
  tuning.canvas_maxAR
);

// After:
const belowRowCount = calculateBelowRowCount(
  belowPhotos,
  heroRowWidth,
  normalizedGap,
  heroAR,
  tuning
);
```

### File: `src/lib/v3/intersection.ts`

**Update call sites (search for `calculateBelowRowCount`):**

For hero layouts:
```typescript
const belowRowCount = calculateBelowRowCount(
  regionAssignment.belowPhotos,
  heroRowWidth,
  normalizedGap,
  heroAR,
  tuning
);
```

For hero-less layouts (pass `heroAR = 0`):
```typescript
const rowCount = calculateBelowRowCount(
  photos, 
  1.0, 
  normalizedGap, 
  0,     // No hero
  tuning
);
```

---

## Technical Details

### The Cell Size Constraint Math

For smallest cell area in BELOW:
```
smallestArea ≈ minAR × rowHeight²
rowHeight ≈ targetWidth × R / (n × meanAR)
```

For `heroArea / smallestArea ≤ maxToSmallest`:
```
R ≥ sqrt(heroAR × n² × meanAR² / (effectiveMinAR × width² × maxToSmallest))
```

The 0.6x factor on `minAR` accounts for worst-case row distribution where the narrowest photo ends up in a wide row.

### Expected Result for heroAR = 2.45, n = 22

With `effectiveMinAR ≈ 0.42` (assuming minAR ≈ 0.7):
```
minRowsByCellSize = ceil(sqrt(2.45 × 484 × 1.21 / (0.42 × 6.0 × 22)))
                  = ceil(sqrt(1435 / 55.4))
                  = ceil(5.09)
                  = 6
```

This forces 6 rows minimum, ensuring cells are large enough to pass the final validation.

---

## Files Modified

| File | Changes |
|------|---------|
| `src/lib/v3/normalized-pack.ts` | Refactor signature to use `V3Tuning`, add cell size constraint |
| `src/lib/v3/region-search.ts` | Update call to match new signature |
| `src/lib/v3/intersection.ts` | Update calls to match new signature |

