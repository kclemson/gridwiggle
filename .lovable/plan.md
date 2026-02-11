

# Soft-Reject Fallback: Score Penalties Instead of Hard Rejects

## Problem

When all sampled configurations fail AR coherence, hero coverage, or prominence checks, `generateCandidates` returns an empty array and the user sees "Layout generation failed." This is common at low photo counts (5-6 photos) where geometry is constrained and all samples converge to the same result.

## Design Intent

Quality checks should influence which candidate wins, not whether any candidate exists. The only true hard reject should be canvas AR bounds (the user's configured shape preference). Everything else becomes a scoring penalty.

## User Outcome

"Layout generation failed" essentially disappears for valid photo sets. Suboptimal layouts score lower and are only chosen when nothing better exists.

## Test Matrix

Before choosing penalty values, here's the full matrix of scenarios across the three checks being softened:

### AR Coherence (threshold: 25%)

This fires when packing drifts the canvas AR away from the sampled target.

| Photos | Heroes | Hero AR | Content mix | Typical deviation | Current outcome | With penalty |
|--------|--------|---------|-------------|-------------------|-----------------|--------------|
| 5 | 1 | 0.67 (portrait) | Mixed | 25-40% | ALL rejected, generation fails | Best-of-few selected, penalty ~0.05-0.15 |
| 5 | 1 | 1.5 (landscape) | Mixed | 20-35% | Most rejected | More candidates survive |
| 8 | 1 | 1.0 (square) | Portrait-heavy | 15-30% | ~50% rejected | Marginal improvement |
| 13 | 1 | any | Mixed | 5-15% | Rarely triggers | No change |
| 20+ | 1 | any | any | <10% | Never triggers | No change |
| 8 | 2 | both portrait | Mixed | 30-50% | All dual rejected, falls back to single | Dual-hero candidates survive with penalty |

**Key insight:** AR coherence mostly hurts low photo counts where packing is geometry-determined. At 13+ photos, packing has enough flexibility to hit targets.

### Hero Coverage Ceiling (threshold: 50%)

This fires when the hero occupies too much of the canvas.

| Photos | Heroes | Hero AR | Area frac | Typical coverage | Current outcome | With penalty |
|--------|--------|---------|-----------|------------------|-----------------|--------------|
| 5 | 1 | 2.0 (wide) | 0.25-0.35 | 40-55% | Borderline, some rejected | Penalty ~0.05-0.10 for 50-55% |
| 5 | 1 | 0.5 (tall) | 0.30 | 45-60% | Many rejected | Penalized but survives |
| 8 | 1 | any | 0.20-0.30 | 25-40% | Rarely triggers | No change |
| 13+ | 1 | any | any | 15-25% | Never triggers | No change |
| 8 | 2 | both wide | 0.25 | 45-55% combined | Some rejected | Marginal |

**Key insight:** Coverage ceiling mostly matters at low counts where the hero geometrically must be large relative to few content photos. At 8+ photos, the hero naturally shrinks.

### Prominence (threshold: 0.70 = hero area / largest content area)

This fires when the hero isn't visually dominant enough.

| Photos | Heroes | Hero AR | Content ARs | Typical ratio | Current outcome | With penalty |
|--------|--------|---------|-------------|---------------|-----------------|--------------|
| 5 | 1 | 0.5 (tall portrait) | All landscape | 0.5-0.65 | Silently rejected | Penalty ~0.05-0.15 |
| 5 | 1 | 1.5 | Mixed | 0.8-1.5 | Passes | No change |
| 8 | 1 | 0.67 | Landscape-heavy | 0.6-0.75 | Borderline | Slight penalty for 0.6-0.7 |
| 13 | 1 | any | Mixed | 1.0-2.0 | Always passes | No change |
| 8 | 2 | one portrait, one landscape | Mixed | 0.5-0.9 per hero | One hero may fail | Penalized, not killed |

**Key insight:** Prominence mostly fails when hero AR conflicts with content AR distribution (tall hero with wide content). This is a genuine quality issue but shouldn't block generation entirely.

### Combined failure scenarios (multiple checks fail simultaneously)

| Photos | Heroes | Scenario | Checks failing | Current | With penalties |
|--------|--------|----------|----------------|---------|----------------|
| 5 | 1 | Portrait hero, landscape content | AR coherence + prominence | Generation fails | Cumulative penalty ~0.15-0.25, still selected as only option |
| 5 | 1 | Wide hero, few portrait content | AR coherence + coverage | Generation fails | Cumulative penalty ~0.10-0.20 |
| 6 | 1 | Square hero, all portrait | AR coherence only | Generation fails | Penalty ~0.05-0.10 |
| 8 | 2 | Both heroes portrait | AR coherence (dual) | Falls back to single | Dual candidates available with penalty |

## Proposed Penalty Values

Based on the matrix, penalties should be:
- **Proportional** to how far past the threshold
- **Capped** so even worst-case cumulative penalty doesn't push score to zero
- **Floor** of 0.05 on final score so heavily-penalized candidates still participate

```text
AR coherence penalty:
  0 if deviation <= 0.25
  scales linearly from 0 to 0.3 as deviation goes from 0.25 to 0.50+
  formula: min(0.3, (deviation - 0.25) * 1.2)

Hero coverage penalty:
  0 if coverage <= 0.50
  scales linearly from 0 to 0.3 as coverage goes from 0.50 to 0.70+
  formula: min(0.3, (coverage - 0.50) * 1.5)

Prominence penalty:
  0 if ratio >= 0.70
  scales linearly from 0 to 0.3 as ratio goes from 0.70 to 0.40
  formula: min(0.3, (0.70 - ratio) * 1.0)

Final score: max(0.05, rawScore - arPenalty - coveragePenalty - prominencePenalty)
```

Worst-case cumulative penalty: 0.9 (all three maxed). With a typical rawScore of 0.5-0.8, this floors at 0.05 -- the candidate is heavily deprioritized but not discarded.

## Solution (code changes)

**File:** `src/lib/v4/index.ts`

### In `generateCandidates` (lines 350-387)

Replace three `continue` statements with penalty computation:

1. **Lines 351-358** (AR coherence): Remove `continue`, compute `arPenalty`
2. **Lines 360-367** (hero coverage): Remove `continue`, compute `coveragePenalty`
3. **Line 382** (prominence): Remove `continue`, compute `prominencePenalty`
4. **Line 387** (score): Subtract penalties from raw score with 0.05 floor

Keep devLogger warnings so debug panel still shows when penalties applied.

### In `generateDualHeroCandidates` (lines 581-598)

Same pattern: replace `continue` with penalties at:
1. **Line 584** (AR coherence)
2. **Line 586** (hero coverage)
3. **Line 598** (prominence)

### In `LayoutCandidateMeta` (line 23)

Add optional `penalties` field for debug visibility:
```
penalties?: { ar: number; coverage: number; prominence: number };
```

### Canvas AR bounds check stays as hard reject

Lines 341-348 and 581: these enforce the user's shape preference and remain `continue`.

## What does NOT change

- Canvas AR bounds remains hard reject
- Scoring formula, balance scoring, weighted selection untouched
- No new tuning parameters or data structures
- Packing, templates, region logic untouched
- Debug panel shows penalties via existing metadata

