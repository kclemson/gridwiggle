

# Wire Topology Constraints Through to Dual-Hero Packing

## The Problem

The constraint type (`height` vs `width`) is already declared on each `TopologyRegionSpec` in `hero-constraints.ts`, and the single-hero path already reads it generically. But the dual-hero path in `generateDualHeroCandidates` ignores the topology specs and hardcodes `constraint: 'height'` for all 3 regions. This causes Region 2 to float its width, creating the blank space.

## The Fix (Two Parts)

### Part 1: Fix the topology declaration

In `diagonalCornersTopology` (`hero-constraints.ts`), change Region 2's constraint from `'height'` to `'width'`. This makes the topology the single source of truth:

- Region 0 (beside H1): `constraint: 'height'`, `hardDimension: hH1`
- Region 1 (middle band): `constraint: 'width'`, `hardDimension: 0` (set by engine after packing Region 0)
- Region 2 (beside H2): `constraint: 'width'`, `hardDimension: 0` (set by engine after packing Region 0)

Region 2's hard dimension (width) will be computed by the engine as `heroRow1Width - wH2 - gap`, and Hero 2's height will be matched to the packed result.

### Part 2: Make dual-hero packing read from topology

In `generateDualHeroCandidates` (both `v4/index.ts` and `layoutWorker.ts`), replace the 3 manually-constructed `PackableRegion` blocks with a loop that reads `constraint` from `topology.regions[i]`, mirroring how the single-hero path already works at line 306:

```typescript
// Single-hero path already does this correctly:
const regions: PackableRegion[] = topology.regions.map((spec, i) => ({
  constraint: spec.constraint,        // <-- reads from topology
  targetDimension: spec.hardDimension,
  ...
}));
```

The dual-hero path will do the same, then apply staged packing logic (pack Region 0 first to determine widths for Regions 1 and 2).

## Technical Details

### File: `src/lib/v3/hero-constraints.ts`

In `diagonalCornersTopology`, change Region 2:

```typescript
// BEFORE
{
  constraint: 'height',
  hardDimension: hH2,
  softDimension: Math.max(0.01, targetBesideH2Width),
  offset: { x: gap, y: 0 },
}

// AFTER
{
  constraint: 'width',
  hardDimension: 0,  // set by engine after packing Region 0
  softDimension: hH2, // height hint (soft target)
  offset: { x: gap, y: 0 },
}
```

### File: `src/lib/v4/index.ts`

In `generateDualHeroCandidates` (~lines 515-558), replace the three manual `PackableRegion` constructions with a generic build from topology, then apply staged dimension assignment:

1. Build all 3 regions from `topology.regions` reading `spec.constraint`
2. Pack Region 0 (height-constrained at hH1) -- unchanged
3. Compute `heroRow1Width` -- unchanged
4. Set Region 1's `targetDimension = heroRow1Width` (it's width-constrained) -- unchanged
5. Pack Region 1 -- unchanged
6. Set Region 2's `targetDimension = heroRow1Width - wH2 - gap` (now width-constrained, pinned to match top row)
7. Pack Region 2
8. Set Hero 2's height to `region2.result.height` (discovered, not formula-derived)
9. Remove `heroRow2Width` calc -- canvas width is just `heroRow1Width` by construction

### File: `src/workers/layoutWorker.ts`

Mirror the same changes as `v4/index.ts`.

### No other files need changes

- `TopologyRegionSpec` and `PackableRegion` types already have the `constraint` field
- `convertToLayout`, scoring, and `LayoutInfoPanel` all work generically

## Why This Architecture Is Resilient

With this change, adding a new template (e.g., edge-band with 4 regions) only requires:
1. Define the topology function with N regions, each declaring its own constraint
2. The engine's generic loop reads those constraints and packs accordingly
3. No index-based `if` logic needed in the packing code

