
## Remove "v3" Prefix from DevLogger Categories

### Design Intent
Since V3 is now the main (and only) layout algorithm, the "v3" prefix is redundant. Simplify log categories to describe what they're logging, not which algorithm version they belong to.

### User Outcomes
- Cleaner, more semantic log categories
- Debug Panel shows domain-focused categories instead of version prefixes
- Easier to filter logs by what they describe (layout, region, row-packing)

---

### Changes Overview

| Current Category | New Category | Rationale |
|------------------|--------------|-----------|
| `'v3'` | `'layout'` | General layout algorithm logs |
| `'v3-split'` | `'region'` | Region assignment search (aligns with naming refactor) |
| `'v3-ar-budget'` | `'row-pack'` | AR-budget row distribution |

---

### Files to Update

**1. `src/lib/v3/index.ts`**
- Lines 101, 120, 133, 147, 164: Change `'v3'` → `'layout'`

**2. `src/lib/v3/intersection.ts`**
- Lines 81, 107, 114, 140, 149, 163, 216, 240, 248, 263, 275, 294, 490, 499: Change `'v3'` → `'layout'`

**3. `src/lib/v3/row-pack.ts`**
- Line 285: Change `'v3'` → `'layout'`

**4. `src/lib/v3/entities/canvas.ts`**
- Lines 49, 55: Change `'v3'` → `'layout'`

**5. `src/lib/v3/split-search.ts` → `region-search.ts`**
- All instances of `'v3-split'` → `'region'`
- (This aligns with the naming refactor we're doing anyway)

**6. `src/lib/v3/utils.ts`**
- Lines 175, 214, 223, 250, 284, 295: Change `'v3-ar-budget'` → `'row-pack'`

---

### Technical Notes

**Combining with the naming refactor:**
Since we're already renaming `split-search.ts` → `region-search.ts` and updating devLogger tags there from `'v3-split'` to `'v3-region'`, we can simply go directly to `'region'` instead.

**Production log unchanged:**
The `console.warn('[V3 Layout] Generation failed', ...)` in `index.ts` line 137 should keep its `[V3 Layout]` prefix as you mentioned wanting to preserve this production-visible log.

---

### Summary of New Categories

```text
┌─────────────┬───────────────────────────────────────────────┐
│ Category    │ What it logs                                  │
├─────────────┼───────────────────────────────────────────────┤
│ layout      │ Main algorithm flow, config selection, canvas │
│ region      │ Region assignment search, validation          │
│ row-pack    │ AR-budget distribution, row merging           │
└─────────────┴───────────────────────────────────────────────┘
```
