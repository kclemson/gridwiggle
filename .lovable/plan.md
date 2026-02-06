

# Remove and Consolidate Hardcoded Values in V2

## Problem

V2 is riddled with magic numbers that:
1. **Prevent mathematical flexibility** - e.g., fixed canvas width of 480px
2. **Are duplicated** - 0.30, 0.60 appear multiple times
3. **Encode assumptions** - 3.5 photos per row, 1.2 landscape threshold
4. **Are completely unnecessary** - canvas width should come from caller

## Complete Inventory

| File | Line | Value | Purpose | Action |
|------|------|-------|---------|--------|
| `index.ts` | 85 | `480` | Canvas width | **DELETE** - pass from caller |
| `math.ts` | 261 | `0.30` | Min hero fraction | Use from tuning |
| `math.ts` | 261 | `0.60` | Max hero fraction | Use from tuning |
| `math.ts` | 276 | `0.45` | Fallback hero fraction | Compute as midpoint |
| `math.ts` | 295 | `0.45` | Fallback hero fraction | Compute as midpoint |
| `pack.ts` | 121 | `3.5` | Target photos per row | Already passed as param (good) |
| `pack.ts` | 174 | `3.5` | Target photos per row | Already passed as param (good) |
| `score.ts` | 48 | `1.2` | Landscape AR threshold | Add to tuning |
| `score.ts` | 54 | `0.83` | Portrait AR threshold | Add to tuning |
| `score.ts` | 61 | `0.1` | Square tolerance | Add to tuning |
| `score.ts` | 144 | `1.5` | Hero prominence weight | Add to tuning |
| `strategy.ts` | 129 | `4` | Max beside count | Add to tuning |
| `strategy.ts` | 129 | `3` | Beside count divisor | Add to tuning |
| `strategy.ts` | 135-137 | `3, 6` | Row count thresholds | Add to tuning |
| `types.ts` | 103-108 | defaults | V2Tuning defaults | Keep but document |

---

## Changes by File

### 1. `src/lib/v2/types.ts` - Expand V2Tuning

Add missing tuning parameters:

```typescript
export interface V2Tuning {
  // Existing...
  heroAreaMultiplier: number;
  minHeroCanvasPercent: number;
  maxHeroCanvasPercent: number;
  areaUniformityWeight: number;
  shapeComplianceWeight: number;
  targetPhotosPerRow: number;
  
  // NEW: Hero side layout
  heroMinFraction: number;      // Min hero width as fraction (0.30)
  heroMaxFraction: number;      // Max hero width as fraction (0.60)
  maxBesidePhotos: number;      // Max photos beside hero (4)
  
  // NEW: Shape thresholds
  landscapeMinAR: number;       // AR >= this is landscape (1.2)
  portraitMaxAR: number;        // AR <= this is portrait (0.83)
  squareTolerance: number;      // ±this from 1.0 is square (0.1)
  
  // NEW: Scoring weights
  heroProminenceWeight: number; // Weight for hero scoring (1.5)
}
```

### 2. `src/lib/v2/index.ts` - Remove Canvas Width

**DELETE line 85** and require canvas width from the caller or derive from container.

The caller already has `settings` which should include container width, or we compute based on the preview container.

```typescript
// BEFORE:
const canvasWidth = 480;

// AFTER:
// Canvas width comes from settings or is computed from target aspect ratio
// For now, use settings or derive from photo set
```

Actually, looking at this more carefully - the canvas width is fundamentally arbitrary. What matters is the **aspect ratio** of the canvas and the **relative sizes** of cells. The caller can scale the result.

**New approach**: Pass `canvasWidth` as a parameter to `generateCollageLayoutV2`:

```typescript
export interface GenerateLayoutV2Options {
  photoWeights?: Record<string, number>;
  randomize?: boolean;
  tuning?: Partial<V2Tuning>;
  canvasWidth?: number;  // NEW - optional, defaults to something reasonable
}
```

Or even better - compute from `settings.shape` and photo aspect ratios.

### 3. `src/lib/v2/math.ts` - Use Tuning for Fractions

**Lines 261, 276, 295**: Replace hardcoded fractions with tuning values.

The function signature already accepts `minFraction` and `maxFraction` as params, but the **defaults** are hardcoded. Change the call sites to pass tuning values.

### 4. `src/lib/v2/score.ts` - Use Tuning for Thresholds

**Lines 48, 54, 61, 144**: Read from tuning instead of magic numbers.

```typescript
// BEFORE:
if (ar >= 1.2) return 1;

// AFTER:
if (ar >= tuning.landscapeMinAR) return 1;
```

### 5. `src/lib/v2/strategy.ts` - Use Tuning for Counts

**Line 129**: Use tuning for beside count calculation
**Lines 135-137**: Use tuning for row count thresholds

---

## Why Remove `canvasWidth = 480`?

This is the most important change. The algorithm currently:
1. Forces a 480px canvas width
2. Lets height vary based on content
3. Always produces portrait layouts when content is tall

**What should happen instead**:
- The target **shape** (`landscape`, `portrait`, `square`, `auto`) should drive the canvas dimensions
- The algorithm should compute both width AND height to achieve the target shape
- Cell sizes are relative, not absolute - the caller can scale

For now, we'll make `canvasWidth` a parameter (not hardcoded). Later, we can derive it from the target shape and photo geometry.

---

## Implementation Order

1. **Expand `V2Tuning`** in types.ts with all new parameters
2. **Update `DEFAULT_V2_TUNING`** with current hardcoded values
3. **Update `score.ts`** to use tuning values
4. **Update `strategy.ts`** to use tuning values  
5. **Update `math.ts`** to use tuning values passed through
6. **Update `index.ts`** to remove hardcoded 480 and accept it as option

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/v2/types.ts` | Add 8 new properties to V2Tuning interface and defaults |
| `src/lib/v2/score.ts` | Replace 4 magic numbers with tuning reads |
| `src/lib/v2/strategy.ts` | Replace beside/row thresholds with tuning reads |
| `src/lib/v2/math.ts` | Pass tuning through to fraction calculation |
| `src/lib/v2/index.ts` | Remove hardcoded 480, add canvasWidth to options |

---

## Result

After this cleanup:
- **Zero magic numbers** embedded in algorithm logic
- All tunables visible in one place (`V2Tuning`)
- Canvas width controlled by caller, not hardcoded
- Foundation laid for true area-based optimization (since we can now vary canvas dimensions)

