

# Forgiving Prominence Check: Top N% Average

## Design Intent

Replace the strict "hero vs single largest" comparison with "hero vs average of top N%". This allows one or two content photos to be similar in size to the hero without triggering rejection, as long as the hero is still prominent relative to the group of large photos.

## Mathematical Definition

**Current:** `prominenceRatio = heroArea / max(contentAreas)`

**Proposed:** `prominenceRatio = heroArea / avg(top N% of contentAreas)`

Where N% is configurable (e.g., 20% = compare against average of largest 20% of content).

With 17 content photos at 20%: top 4 photos averaged.
With 5 content photos at 20%: top 1 photo (minimum 1).

## User Outcomes

| Scenario | Current (max) | Proposed (top 20% avg) |
|----------|---------------|------------------------|
| 1 large content photo | Often rejected | May pass (averaged with smaller top photos) |
| Multiple similar-sized large photos | Rejected | Still rejected (average stays high) |
| Hero genuinely prominent | Passes | Passes |

## Technical Changes

### 1. Add new tuning parameter

**`src/lib/v3/types.ts`**

```typescript
export interface V3Tuning {
  // ... existing parameters ...
  
  // === Prominence Calculation ===
  /** Top fraction of content photos used for prominence comparison (0.20 = top 20%) */
  hero_prominenceTopFraction: number;
}

export const DEFAULT_V3_TUNING: V3Tuning = {
  // ... existing defaults ...
  hero_prominenceTopFraction: 0.20,  // Compare against avg of top 20%
};
```

### 2. Update validateProminence function

**`src/lib/v3/entities/hero.ts`**

```typescript
export function validateProminence(
  heroArea: number,
  contentAreas: number[],
  tuning: V3Tuning
): { valid: boolean; ratio: number } {
  if (contentAreas.length === 0) {
    return { valid: true, ratio: Infinity };
  }
  
  // Sort descending, take top N% (minimum 1)
  const sorted = [...contentAreas].sort((a, b) => b - a);
  const topCount = Math.max(1, Math.ceil(sorted.length * tuning.hero_prominenceTopFraction));
  const topAreas = sorted.slice(0, topCount);
  
  // Average of top N%
  const avgTopArea = topAreas.reduce((s, v) => s + v, 0) / topAreas.length;
  
  const ratio = heroArea / avgTopArea;
  
  return {
    valid: ratio >= tuning.hero_minProminence,
    ratio,
  };
}
```

### 3. Update feasibility check (canMeetProminenceConstraints)

**`src/lib/v3/feasibility.ts`**

The feasibility check estimates whether prominence constraints can be met. It currently uses a conservative single-max estimate. We need to adjust it to account for the averaged approach.

Simplified approach: keep existing conservative estimate for feasibility (it's a "can we possibly meet" check, not exact validation), but the actual validation will use the new averaging.

## Example Calculation

Your screenshot case:
- 17 content photos
- Top 20% = ceil(17 * 0.2) = 4 photos
- If top 4 areas are [1.0, 0.95, 0.90, 0.85] → avg = 0.925
- Hero area = 0.81
- **New ratio = 0.81 / 0.925 = 0.88** (still below 1.1 threshold)

To make this case pass, we'd need either:
- Lower threshold: `hero_minProminence: 0.85`
- Or higher fraction: `hero_prominenceTopFraction: 0.30` (more photos in denominator = lower avg)

Given your goal of "hero just needs to be prominent, not necessarily THE largest," consider:
- `hero_prominenceTopFraction: 0.25` (top 25%)
- `hero_minProminence: 0.9` (hero must be 90% as large as avg of top group)

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Add `hero_prominenceTopFraction` parameter |
| `src/lib/v3/entities/hero.ts` | Update `validateProminence` to use top N% average |

## Tuning Recommendations

For your case (hero AR 0.62 failing at ratio 0.81):

**Conservative:** `topFraction: 0.20`, `minProminence: 0.9`
**Moderate:** `topFraction: 0.25`, `minProminence: 0.85`
**Permissive:** `topFraction: 0.30`, `minProminence: 0.80`

I recommend starting with **moderate** values and adjusting based on visual results.

