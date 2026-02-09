

# Root Cause Analysis: Canvas AR Asymmetry

## The Smoking Gun

I traced through the geometry and found a **hard vs. soft constraint asymmetry** that explains why layouts keep producing extreme portrait canvases (AR 0.35-0.47) but never extreme landscape canvases:

| Constraint | When Violated | Enforcement | Result |
|------------|---------------|-------------|--------|
| `canvas_maxAR` (too wide) | Line 248 in region-search.ts | **HARD** (`continue`) | Never added to candidates |
| `canvas_minAR` (too tall) | Lines 207-228, 274-284 | **SOFT** (softRejection set, but candidate still added) | Can still win via F-ratio scoring |

## Why F-Ratio Rewards Extreme Portrait

When `besideCount = 0` and BELOW has many rows:
- Hero area = 1.75 × 1.0 = **1.75**
- BELOW cells (split across 10+ rows): area ≈ **0.12** each
- F-ratio sees: Huge variance between tiers, low variance within tiers
- **Result**: HIGH coherence score → wins weighted selection

The very thing that makes a canvas "too tall" (many small BELOW cells) also produces the highest F-ratio.

## Test Matrix: 46 Photos, Landscape Hero (AR = 1.75)

| BesideCount | BelowRows | CanvasAR | F-ratio | Enforcement | Outcome |
|-------------|-----------|----------|---------|-------------|---------|
| 0 | 12 | **0.35** | HIGH | Soft reject | **CAN WIN** |
| 0 | 8 | **0.47** | HIGH | Soft reject | **CAN WIN** |
| 0 | 5 | 0.70 | Medium | Valid | Can win |
| 6 | 6 | 0.65 | Medium | Valid | Can win |
| 12 | 3 | **2.5+** | - | **Hard skip** | NEVER seen |

The system explores 0→12 beside configurations, but:
- High besideCount → hard-rejected for canvas_maxAR → never scored
- Low besideCount → soft-rejected for canvas_minAR → scored, often wins

## The Fix

Make `canvas_minAR` a **hard constraint** like `canvas_maxAR`:

**File: `src/lib/v3/region-search.ts`**

**Change 1** (around line 207): For `besideCount === 0` branch:
```typescript
// BEFORE: Soft rejection
if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
  softRejection = { reason: 'canvas_too_tall', ... };
}
// ... still adds to validRegionAssignments

// AFTER: Hard skip (symmetry with canvas_maxAR)
if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
  continue; // Skip, don't add
}
```

**Change 2** (around line 274): For `besideCount > 0` branch:
```typescript
// BEFORE: Soft rejection
if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
  softRejection = { reason: 'canvas_too_tall', ... };
}
// ... still adds to validRegionAssignments

// AFTER: Hard skip
if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
  continue; // Skip, don't add
}
```

## Expected Impact

| Scenario | Before | After |
|----------|--------|-------|
| 46 photos, landscape hero | Canvas AR 0.35-0.85 (wild portrait bias) | Canvas AR 0.50-0.85 (bounded) |
| Portrait hero | No change (already produces valid ARs) | No change |
| Edge cases | Soft rejections selected | Only valid configs selected |
| Fallback | Still triggers if ALL configs rejected | Same (fallback always works) |

## Why This Is Simple

This is a **one-line change in two places** - we're just making the enforcement symmetric. No new logic, no new scoring complexity. The F-ratio can continue rewarding hierarchy within the valid canvas AR bounds.

## Alternative Considered (and Rejected)

We could penalize soft rejections in scoring (multiply by 0.3). But this adds complexity and doesn't address the root cause. Hard enforcement is cleaner and matches the existing pattern for `canvas_maxAR`.

