

# Add Performance Diagnostics to Layout Info Panel

## Problem
The Layout Info Panel shows layout math (AR, coverage, scores) but nothing about **why** generation was slow. Key performance signals -- duration, candidate count, which code path ran, whether it used the worker, and whether dual-hero fell back to single-hero -- are either buried in logs or not surfaced at all.

## What users will see
A new "Performance" section at the top of the Layout Info Panel showing:
- **Duration** (color-coded green/amber/red like the existing DebugLogPanel badge)
- **Path**: single-hero vs dual-hero, and whether dual-hero fell back to single-hero
- **Worker**: whether layout ran on the web worker or fell back to sync (main thread = UI jank)
- **Candidates explored**: how many candidates were generated (high count = slow)
- **Templates tried**: how many unique configs were sampled

## Changes

### 1. Emit performance metadata from the V4 engine
**File: `src/lib/v4/index.ts`**

Add these fields to the `layoutMeta` object built at line 1071:
- `path`: `'single-hero'` | `'dual-hero'` | `'dual-hero-fallback-single'` (the fallback case at line 1036)
- `photoCount`: total photos
- `contentCount`: content photos (non-hero)
- `heroCount`: 1 or 2

The `candidateCount` is already there. No new iteration tracking needed -- the existing `candidates.length` captures it.

To track the dual-hero fallback, add a local variable before the candidate generation block (~line 1022) and set it when the fallback triggers.

### 2. Pass timing + worker flag through layoutMeta
**File: `src/pages/Index.tsx`** (line 253)

When setting `layoutMeta`, merge in `durationMs` and `usedWorker`:
```
setLayoutMeta({
  ...(result.layoutMeta ?? {}),
  durationMs: result.durationMs,
  usedWorker: result.usedWorker,
});
```

**File: `src/pages/V3Test.tsx`** (line 169)

Same pattern -- merge `durationMs` and `usedWorker: false` (V3Test runs synchronously).

### 3. Display performance section in LayoutInfoPanel
**File: `src/components/debug/LayoutInfoPanel.tsx`**

Add a performance block at the top of the V4 metadata display, before the existing template line:

```
--- Performance ---
123.4ms (green/amber/red)  |  worker  |  dual-hero  |  42 candidates
```

Extract `durationMs`, `usedWorker`, `path`, `photoCount`, `contentCount`, `heroCount` from the meta object. Use the same color thresholds as DebugLogPanel's DurationBadge (good: <=50ms, warn: <=200ms, red: >200ms).

### 4. Worker file -- no changes needed
The worker already returns `durationMs` and the V4 engine's `layoutMeta`. The `usedWorker` flag is set by `layoutGenerationService.ts`. No worker code changes required.

## Technical details

### Fields added to layoutMeta

| Field | Type | Source |
|-------|------|--------|
| `path` | `'single-hero'` / `'dual-hero'` / `'dual-hero-fallback-single'` | V4 engine |
| `photoCount` | number | V4 engine |
| `contentCount` | number | V4 engine |
| `heroCount` | number | V4 engine |
| `durationMs` | number | Merged in Index.tsx / V3Test.tsx |
| `usedWorker` | boolean | Merged in Index.tsx / V3Test.tsx |

### Files modified
- `src/lib/v4/index.ts` -- add path/count fields to layoutMeta
- `src/pages/Index.tsx` -- merge durationMs + usedWorker into layoutMeta
- `src/pages/V3Test.tsx` -- same merge
- `src/components/debug/LayoutInfoPanel.tsx` -- render performance section

### What does NOT change
- Worker code
- Layout generation logic / scoring
- Topology / hero-constraints
- DebugLogPanel (keeps its own duration badge independently)

