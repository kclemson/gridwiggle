
# Fix V3 Layout Generation Failures

## Problem Summary

The V3 layout engine is rejecting valid configurations due to:
1. **Floating-point boundary precision** - Canvas AR of 0.67 equals the minimum (0.67) but fails `<` comparison
2. **Double validation mismatch** - Split-search validates canvas AR without borders, then `evaluateNormalizedProposal` re-validates WITH borders, causing previously-valid configurations to fail

## Root Cause Deep Dive

### Issue 1: Boundary Precision
In `split-search.ts` line 101:
```typescript
if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR)
```
A canvas AR of `0.6699999` (floating-point for 0.67) fails even though it's at the valid boundary.

### Issue 2: Border-Induced AR Shift
Split-search calculates canvas AR as:
```
canvasAR = heroRowWidth / totalHeight
```

But `evaluateNormalizedProposal` adds borders:
```typescript
const normalizedWidthWithBorder = normalizedWidth + 2 * normalizedGap;
const normalizedHeightWithBorder = normalizedHeight + 2 * normalizedGap;
```

Adding equal borders to width and height changes the AR toward 1.0 (more square). For a tall canvas (AR < 1), this makes it even closer to the minimum AR threshold.

---

## Technical Changes

### 1. File: `src/lib/v3/split-search.ts`

**Add epsilon tolerance to AR boundary checks** (lines 101-108):

```typescript
// Current (strict comparison):
if (canvasAR < tuning.canvas_minAR || canvasAR > tuning.canvas_maxAR) {

// Fixed (with epsilon tolerance):
const AR_EPSILON = 0.01;
if (canvasAR < tuning.canvas_minAR - AR_EPSILON || canvasAR > tuning.canvas_maxAR + AR_EPSILON) {
```

Apply same fix to the second check at lines 163-171.

### 2. File: `src/lib/v3/intersection.ts`

**Add epsilon tolerance to final AR validation** (lines 262-276):

```typescript
// Current:
if (canvasAR < tuning.canvas_minAR) {
if (canvasAR > tuning.canvas_maxAR) {

// Fixed:
const AR_EPSILON = 0.01;
if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
if (canvasAR > tuning.canvas_maxAR + AR_EPSILON) {
```

### 3. File: `src/lib/v3/split-search.ts`

**Account for border in split-search AR calculation** to prevent mismatch:

The more robust fix is to have split-search use the same AR calculation as the final validation. Add border consideration in split-search:

```typescript
// When calculating canvasAR in split-search, include border effect:
const normalizedWidthWithBorder = heroRowWidth + 2 * normalizedGap;
const normalizedHeightWithBorder = totalHeight + 2 * normalizedGap;
const canvasAR = normalizedWidthWithBorder / normalizedHeightWithBorder;
```

This ensures split-search predicts the same AR that will be computed during final validation.

---

## Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `src/lib/v3/split-search.ts` | Add `AR_EPSILON = 0.01` tolerance to both AR boundary checks | Prevent floating-point boundary rejections |
| `src/lib/v3/split-search.ts` | Include border in canvas AR calculation | Match final validation geometry |
| `src/lib/v3/intersection.ts` | Add `AR_EPSILON = 0.01` tolerance to AR validation | Consistent boundary handling |

---

## Expected Outcome

After these fixes:
- Canvas AR at exactly 0.67 (minimum) will pass validation
- Configurations that pass split-search will also pass final validation
- The "Try Again" button will rarely be needed since first attempts will succeed more reliably
