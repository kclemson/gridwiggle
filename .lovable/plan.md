

# Rename and Adjust Beside Placement Score

## Changes

### File: `src/lib/v3/region-search.ts`

**Location:** Lines 643-648

**Before:**
```typescript
// Variety bonus: reward having beside photos (structural interest)
// 0-beside layouts are valid but less visually interesting
// Penalty increased from 0.7 to 0.5 to reduce full-width hero frequency
const varietyScore = besideResult.cells.length > 0 ? 1.0 : 0.5;

// Combined score: uniformity (35%) + parity (35%) + variety (30%)
return (uniformityScore * 0.35) + (parityScore * 0.35) + (varietyScore * 0.30);
```

**After:**
```typescript
// Beside placement bonus: reward layouts with photos beside the hero
// Full-width hero layouts (0 beside) receive a penalty to reduce their frequency
const besidePlacementScore = besideResult.cells.length > 0 ? 1.0 : 0.4;

// Combined score: uniformity (35%) + parity (35%) + beside placement (30%)
return (uniformityScore * 0.35) + (parityScore * 0.35) + (besidePlacementScore * 0.30);
```

## Impact

The 0.4 value creates an **0.18 point penalty** for full-width layouts (30% × 0.6 difference), up from 0.15 with the 0.5 value. This should push full-width frequency lower.

| Value | Penalty | Expected Effect |
|-------|---------|-----------------|
| 0.7 (original) | 0.09 | ~50% full-width |
| 0.5 (previous) | 0.15 | ~30% full-width |
| 0.4 (new) | 0.18 | ~15-20% full-width |

