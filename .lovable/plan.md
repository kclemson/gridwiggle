

# Plan: Add Per-Cell Area Percentages to Export

## Current State

The export already includes `heroCoverage` (hero's % of canvas), but lacks:
- Individual cell percentages for all photos
- The hero-to-runner-up ratio that determines perceived prominence

## What to Add

### New fields in `RatedLayout` interface:

| Field | Type | Description |
|-------|------|-------------|
| `cellAreaPercents` | `number[]` | All cell areas as % of canvas, sorted descending |
| `heroToRunnerUpRatio` | `number \| null` | Hero area / largest non-hero area (null if no hero) |

### Example in exported JSON:

```json
{
  "heroCoverage": 0.17,
  "cellAreaPercents": [17, 13, 13, 13, 11, 11, 11, 11],
  "heroToRunnerUpRatio": 1.31,
  "tags": ["hero-not-prominent"],
  ...
}
```

## Files to Change

### 1. `src/test/layout/types.ts`

Add to `LayoutTestResult` interface:
```typescript
cellAreaPercents: number[];      // All cell areas as %, sorted descending
heroToRunnerUpRatio: number | null;  // Hero area / runner-up area
```

Add to `RatedLayout` interface:
```typescript
cellAreaPercents: number[];
heroToRunnerUpRatio: number | null;
```

### 2. `src/test/layout/layoutAdapter.ts`

Update `calculateMetrics` to compute:
```typescript
// Calculate all cell area percentages
const cellAreaPercents = layout.cells
  .map(cell => Math.round((cell.width * cell.height) / canvasArea * 100))
  .sort((a, b) => b - a); // Descending

// Calculate hero-to-runner-up ratio
let heroToRunnerUpRatio: number | null = null;
if (heroPhoto && heroCoverage !== null) {
  const heroCell = layout.cells.find(c => c.photoId === heroPhoto.id);
  const nonHeroCells = layout.cells.filter(c => c.photoId !== heroPhoto.id);
  if (heroCell && nonHeroCells.length > 0) {
    const heroArea = heroCell.width * heroCell.height;
    const runnerUpArea = Math.max(...nonHeroCells.map(c => c.width * c.height));
    heroToRunnerUpRatio = heroArea / runnerUpArea;
  }
}
```

### 3. `src/pages/LayoutRating.tsx`

Update `handleRate` to include new fields:
```typescript
const ratedLayout: RatedLayout = {
  // ...existing fields...
  cellAreaPercents: currentResult.cellAreaPercents,
  heroToRunnerUpRatio: currentResult.heroToRunnerUpRatio,
};
```

## Analysis Value

With this data, you can correlate ratings like:

| heroCoverage | heroToRunnerUpRatio | Tag | Interpretation |
|--------------|---------------------|-----|----------------|
| 17% | 1.31 | hero-not-prominent | Ratio too low - runner-ups compete |
| 25% | 2.08 | hero-works | Clear dominance |
| 15% | 1.67 | good | Acceptable ratio despite modest coverage |

This helps derive a threshold like "heroToRunnerUpRatio < 1.5 should be penalized."

