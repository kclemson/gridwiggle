
# Plan: Add Low Photo Count Prominence Accommodation

## What We're Building

Two new tuning parameters that reduce the minimum prominence threshold when there are few content photos, improving success rate for 5-7 photo sets without affecting larger sets.

---

## User Experience

| Photo Count | Behavior |
|-------------|----------|
| **≥ 7 photos** | Uses standard `hero_minProminence` (1.3) |
| **< 7 photos** | Uses reduced threshold: `1.3 × 0.85 ≈ 1.1` |

The debug panel gains two new inputs under "Hero prominence" to control this behavior.

---

## Technical Changes

### 1. Add Tuning Parameters

**File**: `src/lib/v3/types.ts`

Add to `V3Tuning` interface:
```typescript
// === Low Photo Count Accommodation ===
/** Content photo threshold for reduced prominence (6 = apply to ≤5 content photos) */
hero_lowCountThreshold: number;
/** Multiplier applied to hero_minProminence for low counts (0.85 = 1.3 → 1.1) */
hero_lowCountMultiplier: number;
```

Add to `DEFAULT_V3_TUNING`:
```typescript
hero_lowCountThreshold: 6,
hero_lowCountMultiplier: 0.85,
```

### 2. Add Helper Function

**File**: `src/lib/v3/utils.ts`

```typescript
/**
 * Calculate effective minimum prominence based on content count.
 * Returns reduced threshold for low photo counts.
 */
export function getEffectiveMinProminence(
  contentCount: number,
  tuning: V3Tuning
): number {
  if (contentCount < tuning.hero_lowCountThreshold) {
    return tuning.hero_minProminence * tuning.hero_lowCountMultiplier;
  }
  return tuning.hero_minProminence;
}
```

### 3. Update Prominence Checks

Three locations need to use the effective prominence instead of `tuning.hero_minProminence`:

**File**: `src/lib/v3/region-search.ts`

1. **Line ~130**: Early feasibility check for besideCount > 0
2. **Line ~198**: No-BESIDE prominence validation  
3. **Line ~310**: With-BESIDE prominence validation

Each check changes from:
```typescript
if (prominenceRatio < tuning.hero_minProminence) {
```
To:
```typescript
const effectiveMinProminence = getEffectiveMinProminence(photos.length, tuning);
if (prominenceRatio < effectiveMinProminence) {
```

**File**: `src/lib/v3/feasibility.ts`

4. **Line ~47**: The `canMeetProminenceConstraints` function needs content count passed in:

```typescript
export function canMeetProminenceConstraints(
  heroAR: number,
  besideCount: number,
  avgBesideAR: number,
  contentCount: number,  // NEW parameter
  tuning: V3Tuning
): { ... } {
  const effectiveMinProminence = getEffectiveMinProminence(contentCount, tuning);
  // Use effectiveMinProminence instead of tuning.hero_minProminence
```

### 4. Update UI Controls

**File**: `src/components/V3TuningSection.tsx`

Add a new row under hero prominence with the two new controls:
```tsx
{/* Row: Low count accommodation */}
<div className="grid grid-cols-2 gap-2">
  <TuningInput
    label="Low Count Threshold"
    tooltip="Use reduced prominence for content counts below this (6 = ≤5 photos)"
    value={tuning.hero_lowCountThreshold}
    onChange={(v) => onTuningChange('hero_lowCountThreshold', v)}
    step={1}
    min={3}
    max={10}
    defaultValue={DEFAULT_V3_TUNING.hero_lowCountThreshold}
  />
  <TuningInput
    label="Low Count Multiplier"
    tooltip="Multiplier for minProminence at low counts (0.85 = 1.3 → 1.1)"
    value={tuning.hero_lowCountMultiplier}
    onChange={(v) => onTuningChange('hero_lowCountMultiplier', v)}
    step={0.05}
    min={0.5}
    max={1.0}
    defaultValue={DEFAULT_V3_TUNING.hero_lowCountMultiplier}
  />
</div>
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Add 2 new tuning params + defaults |
| `src/lib/v3/utils.ts` | Add `getEffectiveMinProminence()` helper |
| `src/lib/v3/feasibility.ts` | Pass content count, use effective prominence |
| `src/lib/v3/region-search.ts` | Use effective prominence in 3 checks |
| `src/components/V3TuningSection.tsx` | Add 2 new input controls |

---

## Expected Impact

- **5-photo sets**: Effective threshold drops from 1.3 to ~1.1, allowing weaker heroes
- **6-photo sets**: Same accommodation applies
- **7+ photo sets**: No change — uses standard 1.3 threshold
- **Estimated improvement**: ~10-15% fewer failures in the 5-7 photo range
