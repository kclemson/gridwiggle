
# Fix: Use Derived Canvas Width in Layout Output

## Problem

Two issues are causing the layout to show Canvas: 480×1423px (AR 0.34):

1. **Output uses input width instead of derived width**: In `index.ts` line 150, the layout returns `Math.round(canvasWidth)` (the 480px input) instead of `config.canvasWidth` (the derived value).

2. **Canvas AR validation may be passing incorrectly**: The normalized-space packing is producing layouts that pass split search validation, but when scaled to meet the 80px cell minimum, the actual canvas AR becomes 0.34 (way below the 0.67 minimum).

---

## Root Cause

The bottom-up approach correctly derives scale from cell sizes, but:
- The split search validates AR **before** the scaling step
- The final AR check **after** scaling should catch violations, but we're not seeing the rejection logs
- Even if it did reject, the output hardcodes width=480 regardless of what the algorithm derived

---

## Changes Required

### 1. `src/lib/v3/index.ts` - Use derived canvas width

**Line 150**: Change from:
```typescript
return {
  width: Math.round(canvasWidth),
  height: Math.round(config.canvasHeight),
  cells,
};
```

To:
```typescript
return {
  width: Math.round(config.canvasWidth),
  height: Math.round(config.canvasHeight),
  cells,
};
```

This ensures the layout output reflects the actual geometry the algorithm derived, not the arbitrary 480px input.

### 2. Add debug logging to trace the flow

Add a log entry showing the final output dimensions vs the input preference to help debug why AR validation isn't rejecting tall layouts:

```typescript
devLogger.log('v3', 'Final layout dimensions', {
  inputWidth: canvasWidth,
  outputWidth: Math.round(config.canvasWidth),
  outputHeight: Math.round(config.canvasHeight),
  outputAR: (config.canvasWidth / config.canvasHeight).toFixed(2),
});
```

---

## Expected Result

After this fix:
- Layouts that derive wider canvases (e.g., 600px for 40+ photos) will display at their correct width
- The LayoutVisualization will render at the correct aspect ratio
- If AR validation is working correctly, layouts with AR < 0.67 should be rejected (return null)
- If layouts with AR < 0.67 are still getting through, we'll have logs to trace where the validation is failing

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/index.ts` | Use `config.canvasWidth` instead of input `canvasWidth` in return statement |
