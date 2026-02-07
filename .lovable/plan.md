

## Naming Refactor: "Split" → "Region"

### Design Intent
Complete the terminology transition from binary "split" to generic "region" naming, preparing for N-way decompositions while maintaining clear, searchable compound terms.

### User Outcomes
- Code reads naturally: `findValidRegionAssignment()` clearly describes finding valid photo→region mappings
- Compound term "RegionAssignment" is always used together, making codebase searchable and consistent
- Function/type names accurately describe what they do

---

### Changes Overview

| Current | New | Location |
|---------|-----|----------|
| `SplitResult` | `RegionAssignment` | types.ts:206 |
| `findBestSplit()` | `findValidRegionAssignment()` | split-search.ts:33 |
| `scoreSplit()` | `scoreRegionAssignment()` | split-search.ts:275 |
| `validSplits` | `validRegionAssignments` | split-search.ts:65, 141, 232, 242-246 |
| `splitResult` | `regionAssignment` | intersection.ts:154, 162, 174, 181-192, 306-307 |
| `split-search.ts` | `region-search.ts` | File rename |

---

### Detailed Changes

**1. `src/lib/v3/types.ts` (line 203-212)**

Update interface name and JSDoc:

```typescript
/**
 * Result of region assignment search.
 * Currently supports 2 regions (beside/below) for corner mode.
 * Will extend to 3 regions (above/beside/below) for edge mode.
 */
export interface RegionAssignment {
  besidePhotos: PhotoDimension[];
  belowPhotos: PhotoDimension[];
  besideRowCount: number;
  belowRowCount: number;
  score: number;
}
```

**2. Rename file: `src/lib/v3/split-search.ts` → `src/lib/v3/region-search.ts`**

Update header comment:
```typescript
/**
 * Region Search
 * 
 * Finds valid distributions of photos across content regions.
 * Uses normalized space packing to evaluate candidate assignments.
 */
```

**3. `src/lib/v3/region-search.ts` (renamed file)**

Changes:
- Line 8: Import `RegionAssignment` instead of `SplitResult`
- Lines 1-6: Update file header comment
- Lines 13-15: Update section comment to "Region Search Algorithm"
- Lines 17-32: Update JSDoc for main function
- Line 33: Rename `findBestSplit` → `findValidRegionAssignment`
- Line 39: Return type `SplitResult` → `RegionAssignment`
- Line 65: `validSplits: SplitResult[]` → `validRegionAssignments: RegionAssignment[]`
- Line 141, 232: Push to `validRegionAssignments` instead of `validSplits`
- Lines 242-256: Reference `validRegionAssignments` in selection logic
- Lines 262-264: Update section comment to "Region Assignment Scoring"
- Lines 266-274: Update JSDoc for scoring function
- Line 275: Rename `scoreSplit` → `scoreRegionAssignment`

**4. `src/lib/v3/intersection.ts`**

Changes:
- Line 22: Import from `'./region-search'` instead of `'./split-search'`
- Line 22: Import `findValidRegionAssignment` instead of `findBestSplit`
- Line 6: Update comment "Find best BESIDE/BELOW split" → "Find valid region assignment"
- Line 154: `const splitResult = findBestSplit(...)` → `const regionAssignment = findValidRegionAssignment(...)`
- Line 162: Check `if (!regionAssignment)` instead of `if (!splitResult)`
- Lines 174, 181-192, 306-307: All references to `splitResult` → `regionAssignment`

---

### Files Modified
1. `src/lib/v3/types.ts` - interface rename
2. `src/lib/v3/split-search.ts` → renamed to `region-search.ts` with internal updates
3. `src/lib/v3/intersection.ts` - import path, import name, and variable renames

