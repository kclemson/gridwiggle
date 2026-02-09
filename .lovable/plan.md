

# Surgical Fix: Remove the "Too Wide" Hard Rejection

## Root Cause

The layout engine systematically selects 0-beside layouts because:

1. **Lines 343-349 in `region-search.ts`**: A "too wide" check hard-rejects high-beside configurations using `minCanvasHeight = 1.0` (hero row only), completely ignoring the height that BELOW photos will add.

2. For example, with `heroRowWidth = 6.0`:
   - `minCanvasHeight = 1.0 + 0.006 ≈ 1.0`
   - `bestCaseAR = 6.0 / 1.0 = 6.0`
   - `6.0 > 2.25 × 1.1 = 2.48` → **HARD REJECTION**
   
   But the actual canvas has BELOW photos adding ~3-4 height, making the real AR ~1.5 (valid!)

## Evidence from Captures

- Canvas AR range: **0.37 – 0.90** (all portraits)
- `canvas_ar_below_minimum_-_soft_rejection_(no_beside)`: Dominant rejection reason
- 0-beside layouts being selected despite 30% scoring penalty

## The Fix: Remove the Hard Rejection Check

### File: `src/lib/v3/region-search.ts`
### Lines: 342-349

```typescript
// BEFORE:
// Canvas AR validation (post-pack check, no logging — outer loop already filtered)
const minCanvasHeight = 1.0 + 2 * normalizedGap;
const canvasWidth = heroRowWidth + 2 * normalizedGap;
const bestCaseAR = canvasWidth / minCanvasHeight;

if (bestCaseAR > tuning.canvas_maxAR * 1.1) {
  continue; // Skip — canvas too wide
}

// AFTER:
// Removed: "too wide" pre-check was too conservative (ignored BELOW height)
// Actual canvas AR is validated after packing (lines 372-422) with full height
```

This check is redundant because:
- Lines 372-422 already validate canvas AR **after** packing, with correct BELOW height
- The soft rejection system handles edge cases
- We're asymmetrically blocking "too wide" but not "too tall"

## Secondary Fix: Force minBeside for Landscape Heroes

### File: `src/lib/v3/feasibility.ts`
### Lines: 172-191

The condition `if (heroAR < 1.0 && totalContentCount > 10)` only calculates `minBeside` for portrait heroes. Landscape heroes get `minBeside = 0` even when they need beside photos to avoid extreme portrait canvases.

```typescript
// BEFORE:
if (heroAR < 1.0 && totalContentCount > 10) {
  // ... minBeside calculation
}

// AFTER:
if (totalContentCount > 10) {
  // Calculate minBeside for ALL heroes with many photos
  // Landscape heroes also benefit from beside width
  // ...rest of calculation...
}
```

## Technical Details

### Why the Bug Matters

The "too wide" check at lines 343-349 fires **before** BELOW is packed. It uses `minCanvasHeight = 1.0` as if there were zero BELOW photos. For configurations with 10+ beside photos:

| Metric | Check's Assumption | Reality |
|--------|-------------------|---------|
| BELOW height | 0 | 3-5 (35+ photos) |
| Canvas height | 1.0 | 4-6 |
| Canvas AR | 6.0 (rejected) | 1.0-1.5 (valid) |

### Why Removing It Is Safe

1. **Actual validation exists**: Lines 372-422 check canvas AR after packing with accurate height
2. **Soft rejections work**: Configs outside ideal bounds get flagged but not skipped
3. **Fixes asymmetry**: Currently blocks "too wide" but not "too tall", biasing toward portraits

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Valid beside configurations | ~3-5 | ~20-30 |
| Canvas AR range | 0.37–0.90 | 0.50–1.50+ |
| Landscape layouts (AR > 1.0) | 0% | 15-30% |

## Files to Change

| File | Change |
|------|--------|
| `src/lib/v3/region-search.ts` | Remove lines 342-349 (the "too wide" hard rejection) |
| `src/lib/v3/feasibility.ts` | Remove `heroAR < 1.0` condition on line 172 |

