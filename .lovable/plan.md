
# Relaxing maxBeside Search Limit for Better Canvas Variety

## Problem Diagnosis

The capture data shows a critical discrepancy:

| Source | Photo Count | heroAR | Canvas AR Range |
|--------|-------------|--------|-----------------|
| V3-test | 5-35 (varies) | varies | 0.45 - 1.45 (good variety) |
| App UI | 46 (same) | 1.755 | 0.27 - 0.60 (all portrait) |

The V3-test works well because it generates **different photo sets** each shuffle. The app UI uses the **same 46 photos** repeatedly, exposing a constraint bug.

For this 46-photo set with landscape hero (AR 1.755):
- The `calculateBesideCountRange` function returns `maxBeside = 4`
- This forces 41 photos into BELOW → extremely tall canvas
- All shuffles produce similarly tall layouts because the range is too narrow

## Root Cause

In `src/lib/v3/feasibility.ts`, line 233:

```typescript
const maxTestBeside = Math.min(totalContentCount, 15); // Reasonable search limit
```

This **artificially caps the search at 15** BESIDE photos, preventing exploration of higher besideCount values that could produce wider canvases.

For 45 content photos:
- Search only tests 0-15 BESIDE configurations
- Higher values (20, 25, 30...) are never evaluated
- Those higher values would move photos from BELOW to BESIDE, shortening the canvas

## The Fix

Remove the arbitrary `15` cap and let geometry fully determine the valid range:

```typescript
// Before
const maxTestBeside = Math.min(totalContentCount, 15);

// After  
const maxTestBeside = totalContentCount;
```

This allows the search to find that putting 20+ photos BESIDE is geometrically valid for certain photo sets, producing wider canvas options.

## Why This Is Safe

The loop already has a **natural stopping condition** — it stops when `requiredHeroRowWidth > maxHeroRowWidth`. The width limit from `canvas_maxAR` naturally constrains how many photos can go BESIDE without making the canvas too wide.

The `15` limit was a premature optimization that:
1. Made search faster (O(15) vs O(n))
2. Accidentally restricted variety for large photo sets

For n=45 photos, this changes search from O(15) to O(45) — still fast enough (< 1ms).

## Implementation

**File: `src/lib/v3/feasibility.ts`**

Line 233, change:
```typescript
const maxTestBeside = Math.min(totalContentCount, 15); // Reasonable search limit
```

To:
```typescript
const maxTestBeside = totalContentCount; // Let geometry determine the limit
```

## Expected Impact

For 46 photos with landscape hero (AR 1.755):

| Metric | Before | After |
|--------|--------|-------|
| maxBeside | 4 | 15-25 (geometry-limited) |
| Canvas AR range | 0.27 - 0.60 | 0.50 - 1.20+ |
| Layouts with AR > 1.0 | 0% | ~20-40% |

## Summary

This is a single-line change that removes an artificial search limit. The geometric constraints (`canvas_maxAR`, prominence, etc.) already ensure valid configurations — we just weren't searching far enough to find them.
