

# Radical Simplification: Strip the Overconfident Constraints

## The Pattern We've Seen

Throughout V3 development, we repeatedly:
1. Built something with tight constraints we thought defined "good"
2. Found layouts looking too similar
3. Relaxed those constraints and things looked better

This suggests the core issue isn't missing features—it's **too many constraints baked in from assumptions we now know were wrong**.

---

## What We KNOW Is Important (Keep)

| Constraint | Purpose | Evidence |
|------------|---------|----------|
| Canvas AR bounds (0.5-2.25) | Prevent absurdly tall/wide canvases | Users complained about extremes |
| Prominence check | Hero must feel like a hero | Visual hierarchy is the point |
| Cell packing | Photos must fill their rows | Core geometry requirement |

---

## What We Thought Was Important But Probably Isn't (Remove/Loosen)

### 1. **hero_maxToSmallest (lines 343-352 in normalized-pack.ts, lines 48-62 in feasibility.ts)**

**Original assumption**: "Tiny content cells look bad, so hero can't be more than 45× the smallest cell"

**What we know now**: With F-ratio scoring rewarding tier coherence, we *want* size variety. This constraint actively fights against the goal.

**Proposed change**: Remove entirely or set to a very high value (e.g., 200)

---

### 2. **row_maxHeightRatio (lines 285-347 in utils.ts)**

**Original assumption**: "Rows that are too different in height look unbalanced"

**What we know now**: Row height variation IS the variety we want. The F-ratio scores it. The `validateAndRedistribute` function actively MERGES rows that are "too different" - fighting against variety.

**Proposed change**: Remove the merge logic entirely or set `row_maxHeightRatio` to a very high value (e.g., 10.0)

---

### 3. **Stratified AR Distribution (lines 379-442 in utils.ts)**

**Original assumption**: "Each region should have proportional representation of portrait/square/landscape"

**What we know now**: This enforces sameness. If the hero is portrait, maybe ALL the landscape photos should go BESIDE it. The randomization should decide, not a stratification algorithm.

**Proposed change**: Replace with simple slice: `beside = photos.slice(0, besideCount); below = photos.slice(besideCount);`

---

### 4. **Early Exit in Region Search (lines 471-484 in region-search.ts)**

**Original assumption**: "8 candidates is enough for variety"

**What we know now**: We're not exploring the full space. More candidates = more variety.

**Proposed change**: Remove early exit entirely, or increase to 20+

---

### 5. **Feasibility Pre-Checks (feasibility.ts)**

**Original assumption**: "We can algebraically prune impossible configurations before packing"

**What we know now**: These add complexity and may be over-pruning. With soft rejections, we can just TRY configurations and score them.

**Proposed change**: Remove `canMeetProminenceConstraints` check in region-search.ts (lines 182-197). Let the scoring handle it.

---

## The Simplification

### Before (Current Flow)
```text
1. Calculate besideCount range (feasibility)  
2. For each besideCount:
   a. Stratified distribution to regions
   b. Early prominence feasibility check ← REMOVES OPTIONS
   c. Early canvas AR feasibility check ← REMOVES OPTIONS
   d. Pack with row height redistribution ← HOMOGENIZES ROWS
   e. Validate prominence / maxToSmallest ← REMOVES OPTIONS
   f. Score with F-ratio
3. Early exit after 8 candidates ← STOPS EXPLORING
4. Weighted random select
```

### After (Simplified Flow)
```text
1. Calculate besideCount range (keep - geometry-based)
2. For each besideCount:
   a. Simple slice to regions (random order already shuffled)
   b. Pack WITHOUT row merging
   c. Score with F-ratio + soft rejections for AR bounds
3. Collect ALL candidates (no early exit)
4. Weighted random select
```

---

## Test Matrix: Expected Behavior

| Hero AR | Photos | Before (Constrained) | After (Simple) |
|---------|--------|---------------------|----------------|
| 1.7 (landscape) | 46 | Row heights ±20%, sameness in BELOW | Row heights can vary 4:1, clear tiers |
| 0.6 (portrait) | 46 | Stratified distribution splits shapes | Could get all landscape beside hero |
| 1.0 (square) | 20 | maxToSmallest rejects high-variety configs | High variety configs pass, scored by F-ratio |
| 1.7 | 8 (low count) | Low count multipliers engaged | Same (keep this accommodation) |
| 0.8 | 30 | ~8 candidates explored | All candidates explored, more variety |

---

## Files to Modify

| File | Change |
|------|--------|
| `types.ts` | Set `hero_maxToSmallest: 200` (effectively disabled) |
| `types.ts` | Set `row_maxHeightRatio: 10.0` (effectively disabled) |
| `utils.ts` | Replace `stratifiedARDistribution` with simple slice |
| `utils.ts` | Remove `validateAndRedistribute` logic (or make it no-op) |
| `region-search.ts` | Remove early prominence feasibility check (lines 182-197) |
| `region-search.ts` | Remove early exit after 8 candidates (lines 471-484) |

---

## Risk Assessment

**Medium risk but controlled**: 
- We're removing guardrails, but F-ratio scoring + canvas AR bounds remain as the "safety net"
- Soft rejections mean we never fail completely
- If layouts look chaotic, we can add specific constraints back one at a time

**Key insight**: It's easier to add constraints to reign in chaos than to loosen constraints to create variety. We should start simple.

---

## Implementation Order

1. Disable `hero_maxToSmallest` and `row_maxHeightRatio` (tuning only)
2. Remove stratified distribution (use simple slice)
3. Remove early feasibility pruning
4. Remove early exit
5. Test and observe

Each step is reversible and can be tested independently.

