
# Radical Simplification: "Does It Spark Joy?"

## Summary

After analyzing the full V3 codebase, there are significant pieces that were added for "safety" or "future features" that are now either dead code, redundant, or actively working against variety. This plan proposes removing them entirely.

---

## Code That Doesn't Spark Joy

### 1. **feasibility.ts: `canMeetProminenceConstraints`** (50+ lines)
- **What it does**: Algebraic prediction of whether row counts can satisfy prominence
- **Why remove**: We removed the call in region-search.ts, but the function still exists. It's dead code.
- **Status**: DEAD CODE

### 2. **"Effective Threshold" Functions** (50+ lines in utils.ts)
- **What they do**: `getEffectiveMinProminence`, `getEffectiveMaxToSmallest`, `getEffectiveCanvasMinAR`, `getEffectiveCanvasMaxAR` — adjust limits for "low photo counts"
- **Why remove**: Extra complexity for edge cases. With soft rejections, low counts just produce soft-rejected layouts that still render. Let users see them.
- **Status**: OVER-ENGINEERING for edge cases

### 3. **hero_maxToSmallest Validation** (20+ lines in intersection.ts, hero.ts)
- **What it does**: Prevents "tiny cells" by limiting hero-to-smallest ratio
- **Why remove**: Set to 200 (effectively disabled), but code still runs, logs, and creates soft rejections. If it's disabled, remove it.
- **Status**: DEAD CODE (tuning disabled)

### 4. **row_maxHeightRatio / validateAndRedistribute** (15+ lines in utils.ts)
- **What it does**: Was meant to merge rows with "too different" heights
- **Why remove**: Already a no-op (just returns rows). The parameter and function signature are noise.
- **Status**: DEAD CODE (function is no-op)

### 5. **Edge/Floating Decomposition Modes** (40+ lines in hero.ts, intersection.ts)
- **What they do**: Propose edge/floating hero positions
- **Why remove**: intersection.ts just logs "not implemented" and uses corner fallback. Never worked.
- **Status**: DEAD CODE (never implemented)

### 6. **Duplicate Canvas AR Validation** (30+ lines)
- **What it does**: region-search.ts validates canvas AR and sets softRejection. Then intersection.ts validates it AGAIN.
- **Why remove**: One check is enough. Keep it in region-search (closer to the source).
- **Status**: DUPLICATION

### 7. **coefficientOfVariation for Uniformity Score** (used in intersection.ts:567)
- **What it does**: Part of `scoreConfiguration` — rewards area uniformity
- **Why remove**: We now have F-ratio scoring in region-search that REWARDS hierarchy. The intersection scoring still penalizes hierarchy via uniformity. These conflict!
- **Status**: CONFLICTING GOALS

---

## What We Keep (Sparks Joy)

| Component | Purpose | Evidence |
|-----------|---------|----------|
| Canvas AR bounds (0.5-2.25) | Prevent absurd proportions | Users complained |
| F-ratio tier coherence | Reward visual hierarchy | Recent addition, aligns with goals |
| Per-row prominence check | Hero must be prominent in its row | Core visual requirement |
| AR-budget row distribution | Creates organic row variety | Working well with 0.6 jitter |
| Weighted random selection | Variety between shuffles | Core UX goal |
| Soft rejections | Always generate something | Core UX goal |

---

## Implementation Plan

### File: `src/lib/v3/utils.ts`

**Remove**:
- `getEffectiveMinProminence` function (lines 18-26)
- `getEffectiveMaxToSmallest` function (lines 28-41)
- `getEffectiveCanvasMinAR` function (lines 43-55)
- `getEffectiveCanvasMaxAR` function (lines 57-69)
- `validateAndRedistribute` function (lines 286-293) — or just inline the no-op

**Update** callers to use raw tuning values instead of "effective" wrappers.

### File: `src/lib/v3/feasibility.ts`

**Remove entire file** — it's all dead code after removing effective functions and the prominence pre-check.

**Or if too aggressive**: Remove just `canMeetProminenceConstraints` (lines 27-94).

### File: `src/lib/v3/types.ts`

**Remove from V3Tuning**:
- `hero_maxToSmallest` — disabled, remove entirely
- `row_maxHeightRatio` — disabled, remove entirely
- `hero_lowCountThreshold` — no longer needed without effective functions
- `hero_lowCountMultiplier` — no longer needed without effective functions

### File: `src/lib/v3/entities/hero.ts`

**Remove**:
- `validateSmallestCellRatio` function (lines 134-157) — disabled functionality
- Edge/floating mode proposals (lines 58-79) — never implemented

### File: `src/lib/v3/intersection.ts`

**Remove**:
- Second canvas AR validation (lines 286-314) — already done in region-search
- `validateSmallestCellRatio` call and soft rejection (lines 358-396)
- Edge/floating mode fallback log (lines 169-172)
- Import of `getEffective*` functions

**Simplify** `scoreConfiguration`:
- Remove uniformity scoring (conflicts with F-ratio)
- Just return `prominenceScore + randomTiebreaker`

### File: `src/lib/v3/region-search.ts`

**Remove**:
- Imports of `getEffective*` functions
- Replace calls with raw `tuning.*` values

**Keep**:
- Canvas AR validation (the ONE place we do it)
- F-ratio scoring (the good stuff)
- Weighted random selection

---

## Test Matrix

| Scenario | Before | After |
|----------|--------|-------|
| 46 photos, landscape hero | Complex effective thresholds, duplicate validations | Simple thresholds, single validation |
| 8 photos, portrait hero | lowCountMultiplier relaxes constraints | Same constraints as everyone (may see more soft rejections) |
| 5 photos | Heavily relaxed thresholds | Normal thresholds (layout still generated via soft rejection) |
| All landscape content | Stratified sampling tried to balance | Simple slice (already fixed) |
| Edge mode proposal | Proposed but used corner fallback | Not proposed at all |

---

## Risk Assessment

**Medium risk, high reward**:
- Removing ~200 lines of code
- Simplifying mental model significantly
- Some edge cases (low photo counts) may show more soft rejections in dev mode — but layouts still generate
- If something breaks, we know exactly what we removed and can add it back

---

## Files Changed Summary

| File | Lines Removed | Change Type |
|------|---------------|-------------|
| `utils.ts` | ~60 | Remove effective threshold functions |
| `feasibility.ts` | ~70 OR entire file | Remove dead prominence pre-check |
| `types.ts` | ~8 | Remove disabled tuning params |
| `hero.ts` | ~40 | Remove edge/floating proposals, smallest ratio check |
| `intersection.ts` | ~60 | Remove duplicate validation, simplify scoring |
| `region-search.ts` | ~10 | Simplify threshold calls |

**Total**: ~250 lines removed, significant complexity reduction
