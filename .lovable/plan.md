

# Fix: Increase Orientation Bias Strength

## Problem Identified

The mathematical sampling formula uses too weak a multiplier:

```typescript
const center = 1.0 + orientationBias * 0.25;
```

| Bias | Center | Actual Range (±0.5 spread) |
|------|--------|---------------------------|
| +0.6 (max landscape) | 1.15 | 0.65 - 1.65 |
| 0.0 (balanced) | 1.0 | 0.5 - 1.5 |
| -0.6 (max portrait) | 0.85 | 0.35 - 1.35 |

Even with maximum landscape bias, the center barely shifts past 1.0, so most photos still end up near square or portrait-ish. The row-stacking algorithm then produces tall canvases.

## Solution

Increase the multiplier from `0.25` to `0.5` so the bias has meaningful effect:

```typescript
const center = 1.0 + orientationBias * 0.5;
```

| Bias | New Center | New Range |
|------|------------|-----------|
| +0.6 | 1.30 | 0.8 - 1.8 (mostly landscape) |
| 0.0 | 1.0 | 0.5 - 1.5 (balanced) |
| -0.6 | 0.70 | 0.2 - 1.2 (mostly portrait) |

This produces genuinely different input distributions that should result in varied canvas shapes.

## Changes

### File: `src/test/layout/photoGenerator.ts`

**Line 29** - Increase bias strength:

```typescript
// Before
const center = 1.0 + orientationBias * 0.25;

// After  
const center = 1.0 + orientationBias * 0.5;
```

## Expected Outcome

After this change and a reset:
- `→L` cases should produce more landscape/square canvases
- `→P` cases should still produce portrait canvases  
- `→M` cases should be a mix

The tool will actually test the algorithm's handling of different input photo distributions instead of always feeding it portrait-ish inputs.

## Files Modified

| File | Change |
|------|--------|
| `src/test/layout/photoGenerator.ts` | Increase bias multiplier from 0.25 to 0.5 |

