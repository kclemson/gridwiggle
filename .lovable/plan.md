

# Hatchet Approach: Remove Three Arbitrary Constraints

## Goal

Remove the arbitrary constants and hard rejections that are systematically blocking landscape layouts for large photo sets.

## Changes

### 1. Remove the 0.6× Multiplier in BELOW Row Calculation

**File:** `src/lib/v3/normalized-pack.ts`
**Lines:** 347-348

```typescript
// Before:
// Conservative estimate: use 0.6x minAR to account for distribution variance
const effectiveMinAR = minAR * 0.6;

// After:
// Use actual minAR - the hero_maxToSmallest constraint is validated post-pack anyway
const effectiveMinAR = minAR;
```

**Why:** This 0.6× "safety factor" forces more rows in BELOW, making layouts taller. The `hero_maxToSmallest` constraint is already validated post-pack in `intersection.ts`, so this pre-filtering is redundant and overly conservative.

---

### 2. Convert Prominence Hard Rejection to Soft Rejection

**File:** `src/lib/v3/region-search.ts`
**Lines:** 442-461

```typescript
// Before:
if (prominenceRatio < effectiveMinProminence) {
  // ... capture logic ...
  continue;  // HARD SKIP
}

// After:
if (prominenceRatio < effectiveMinProminence) {
  // ... capture logic ...
  // Soft rejection: allow but track for scoring/diagnostics
  // Don't continue - let the configuration be evaluated
}
```

**Why:** High-beside configurations (which produce wider canvases) have larger beside cells, lower prominence ratios, and get hard-rejected. This systematically eliminates all landscape-capable configurations before they're even scored.

---

### 3. Increase Row Caps from 6 to 10

**File:** `src/lib/v3/feasibility.ts`

**Line 65:**
```typescript
// Before:
const maxPhysicalRows = Math.min(besideCount, 6); // Reasonable cap

// After:
const maxPhysicalRows = Math.min(besideCount, 10); // Allow more rows for large sets
```

**Line 123:**
```typescript
// Before:
const maxRows = Math.min(besidePhotos.length, 6);

// After:
const maxRows = Math.min(besidePhotos.length, 10);
```

**Why:** With many BESIDE photos, limiting to 6 rows forces extremely wide beside regions. Allowing up to 10 rows gives more realistic width estimates.

---

## Pinned for Later

Remove the "too wide" rejection codepath entirely (region-search.ts lines 343-349). Currently, this check rejects configs that would be "too wide" but there's no equivalent check rejecting "too tall" configs. The asymmetry biases toward portraits.

---

## Expected Impact

| Metric | Before | After (Expected) |
|--------|--------|------------------|
| Valid wide configurations | ~0 | 15-25+ |
| Canvas AR range (46 photos) | 0.31–0.68 | 0.50–1.50+ |
| Landscape layouts (AR > 1.0) | 0% | 15-30% |

---

## Files to Edit

| File | Changes |
|------|---------|
| `src/lib/v3/normalized-pack.ts` | Remove 0.6× multiplier (line 348) |
| `src/lib/v3/region-search.ts` | Convert prominence check to soft rejection (lines 442-461) |
| `src/lib/v3/feasibility.ts` | Increase row caps 6→10 (lines 65, 123) |

