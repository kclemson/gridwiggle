
# Plan: Exclude Hero from Supporting Photo Balance Metrics

## Goal

Make `areaCoefficientOfVariation` and `largestToSmallestRatio` measure balance among **supporting photos only**, since hero prominence is already captured by `heroToRunnerUpRatio` and `heroCoverage`. This produces cleaner, orthogonal metrics for analysis.

## Changes

### File: `src/test/layout/types.ts`

Update interface documentation to clarify the metrics measure supporting photos only:

```typescript
export interface LayoutTestResult {
  // ... existing fields ...
  
  // Computed metrics for analysis
  areaCoefficientOfVariation: number;  // Size uniformity of SUPPORTING photos (excludes hero)
  largestToSmallestRatio: number;      // Max/min area among SUPPORTING photos (excludes hero)
  // ... rest unchanged ...
}

export interface RatedLayout {
  // ... same documentation updates for consistency ...
}
```

### File: `src/test/layout/layoutAdapter.ts`

Update `calculateMetrics()` to exclude hero from both metrics:

**Current (lines 53-54, 120-121):**
```typescript
// Calculate cell areas
const areas = layout.cells.map(cell => cell.width * cell.height);
// ...
areaCoefficientOfVariation: coefficientOfVariation(areas),
largestToSmallestRatio: areas.length > 0 ? Math.max(...areas) / Math.min(...areas) : 1,
```

**Proposed:**
```typescript
// Find hero photo ID if present
const heroPhoto = photos.find(p => p.priority === 1);
const heroId = heroPhoto?.id ?? null;

// Calculate cell areas (all photos for cellAreaPercents)
const allAreas = layout.cells.map(cell => cell.width * cell.height);

// Calculate supporting photo areas (excludes hero for balance metrics)
const supportingAreas = heroId 
  ? layout.cells.filter(c => c.photoId !== heroId).map(c => c.width * c.height)
  : allAreas;

// ...later in return...
areaCoefficientOfVariation: coefficientOfVariation(supportingAreas),
largestToSmallestRatio: supportingAreas.length > 1 
  ? Math.max(...supportingAreas) / Math.min(...supportingAreas) 
  : 1,
```

### File: `src/components/layout-rating/MetricsBadges.tsx`

Update badge labels to indicate these exclude hero:

```typescript
<Badge variant="outline" className="font-mono">
  Support CV: {areaCoefficientOfVariation.toFixed(2)}
</Badge>

<Badge variant="outline" className="font-mono">
  Support ratio: {largestToSmallestRatio.toFixed(1)}x
</Badge>
```

## JSON Export

The `RatedLayout` interface in `types.ts` already includes `areaCoefficientOfVariation` and `largestToSmallestRatio`. Since `LayoutRating.tsx` builds `RatedLayout` from `LayoutTestResult` fields, the export will automatically get the updated (hero-excluded) values. No changes needed to the export logic.

**Data flow:**
1. `calculateMetrics()` returns hero-excluded values
2. `runLayoutTest()` spreads metrics into `LayoutTestResult`
3. `handleRate()` copies metrics to `RatedLayout`
4. `handleExport()` serializes `RatedLayout[]` to JSON

## Summary of Metric Responsibilities

| Metric | What it measures | Includes hero? |
|--------|-----------------|----------------|
| `heroCoverage` | Hero canvas % | Hero only |
| `heroToRunnerUpRatio` | Hero vs largest supporting | Comparison |
| `areaCoefficientOfVariation` | Supporting photo uniformity | No |
| `largestToSmallestRatio` | Supporting photo size spread | No |
| `cellAreaPercents` | All photos as % (for detail) | Yes |
