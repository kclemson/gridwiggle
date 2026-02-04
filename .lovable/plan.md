

# Interactive Layout Tuning Controls

## Overview

Add a collapsible "Tuning" section to the debug panel with number inputs that let you experiment with layout algorithm parameters in real-time. Changes trigger immediate collage regeneration.

## Parameters to Expose

Based on my code analysis, here are the **8 key parameters** that control hero balance:

| Parameter | Location | Current | Effect |
|-----------|----------|---------|--------|
| `maxBeside3Row` | layoutBlocks.ts:213 | 12 | Max photos crammed beside hero in 3-row mode |
| `maxBeside2Row` | layoutBlocks.ts:213 | 6 | Max photos beside hero in 2-row mode |
| `threeRowThreshold` | layoutBlocks.ts:154 | 6 | Photo count that triggers 3-row mode |
| `contentPhotosPerBlock` | heroLayout.ts:1298 | 4 | Photos per full-width content row block |
| `heroMinFraction` | heroLayout.ts:184 | 0.30 | Minimum hero width (30% of canvas) |
| `heroMaxFraction` | heroLayout.ts:185 | 0.60 | Maximum hero width (60% of canvas) |
| `scaleToleranceLow` | layoutBlocks.ts:267 | 0.75 | Reject configs that scale below this |
| `scaleToleranceHigh` | layoutBlocks.ts:267 | 1.25 | Reject configs that scale above this |

**Plus a computed readout:**
- `heroPctOfCanvas` - Real-time display of how much canvas area the hero occupies (already computed in logs)

## Architecture

```text
src/types/collage.ts
└── LayoutTuning interface (new)

src/pages/Index.tsx
├── layoutTuning state (useState with defaults)
├── handleTuningChange callback → updates state + regenerates
└── Passes tuning to:
    ├── DebugPanel (for UI controls)
    └── generateCollageLayout (via options)

src/components/DebugPanel.tsx
└── TuningSection (new) with 8 number inputs

src/lib/collageLayout.ts
└── generateCollageLayout → accepts tuning, passes to heroLayout

src/lib/heroLayout.ts
└── generateBlockBasedHeroLayout → uses tuning values
└── calculateOptimalHeroFraction → uses heroMinFraction/heroMaxFraction

src/lib/layoutBlocks.ts
└── buildHeroUnitBlock/tryBuildHeroUnit → uses maxBeside, threshold, tolerance
```

## File Changes

### 1. `src/types/collage.ts` - Add LayoutTuning interface

```typescript
export interface LayoutTuning {
  // Hero beside packing
  maxBeside3Row: number;      // default 12
  maxBeside2Row: number;      // default 6
  threeRowThreshold: number;  // default 6 (candidates >= this → 3-row mode)
  
  // Content blocks
  contentPhotosPerBlock: number;  // default 4
  
  // Hero fraction bounds
  heroMinFraction: number;    // default 0.30
  heroMaxFraction: number;    // default 0.60
  
  // Scale tolerance
  scaleToleranceLow: number;  // default 0.75
  scaleToleranceHigh: number; // default 1.25
}

export const DEFAULT_TUNING: LayoutTuning = {
  maxBeside3Row: 12,
  maxBeside2Row: 6,
  threeRowThreshold: 6,
  contentPhotosPerBlock: 4,
  heroMinFraction: 0.30,
  heroMaxFraction: 0.60,
  scaleToleranceLow: 0.75,
  scaleToleranceHigh: 1.25,
};
```

### 2. `src/components/DebugPanel.tsx` - Add tuning controls

Add a collapsible "Tuning" section above the logs with compact number inputs:

```text
┌─────────────────────────────────────────────────────────┐
│ Hero Layout Logs                                  12:34 │
├─────────────────────────────────────────────────────────┤
│ ⚙️ Tuning                                          [▼]  │
├─────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │ 3-Row Max    │ │ 2-Row Max    │ │ 3-Row At     │     │
│ │     [12]     │ │     [6]      │ │     [6]      │     │
│ └──────────────┘ └──────────────┘ └──────────────┘     │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│ │ Per Block    │ │ Min Frac     │ │ Max Frac     │     │
│ │     [4]      │ │    [0.30]    │ │    [0.60]    │     │
│ └──────────────┘ └──────────────┘ └──────────────┘     │
│ ┌──────────────┐ ┌──────────────┐                      │
│ │ Scale Low    │ │ Scale High   │  Hero: 18.3%        │
│ │    [0.75]    │ │    [1.25]    │  ← computed         │
│ └──────────────┘ └──────────────┘                      │
├─────────────────────────────────────────────────────────┤
│ Logs column 1       │  Logs column 2                   │
└─────────────────────────────────────────────────────────┘
```

Props will be extended:
```typescript
interface DebugPanelProps {
  logs: HeroLogEntry[];
  tuning: LayoutTuning;
  onTuningChange: (key: keyof LayoutTuning, value: number) => void;
}
```

### 3. `src/pages/Index.tsx` - Manage tuning state

- Add `layoutTuning` state with `DEFAULT_TUNING`
- Create `handleTuningChange` callback that:
  1. Updates state
  2. Calls `regenerateCollage({ tuning: newTuning })`
- Pass tuning to `DebugPanel` and `regenerateCollage`
- Update `RegenerateOptions` interface to include optional `tuning`

### 4. `src/lib/collageLayout.ts` - Thread tuning to heroLayout

Update `generateCollageLayout` to accept optional `tuning` in options and pass it through to `generateHeroLayout`.

### 5. `src/lib/heroLayout.ts` - Use tuning values

- Update `generateBlockBasedHeroLayout` signature to accept `tuning`
- Pass tuning to `buildHeroUnitBlock` via options
- Update `calculateOptimalHeroFraction` to accept min/max as params (instead of hardcoded)
- Update `splitPhotosForBlocks` call to use `tuning.contentPhotosPerBlock`

### 6. `src/lib/layoutBlocks.ts` - Accept tuning in block builder

- Extend `HeroUnitOptions` to include tuning parameters
- Replace hardcoded `maxPhotos` (line 213) with `options.maxBeside3Row / maxBeside2Row`
- Replace hardcoded threshold (line 154) with `options.threeRowThreshold`
- Replace scale tolerance check (line 267) with `options.scaleToleranceLow / High`

## Implementation Notes

- **Inputs use `type="number"`** with `step` for decimals (0.01 for fractions, 0.05 for tolerances)
- **Changes trigger immediate regeneration** - no debounce needed for number inputs with blur/Enter
- **Values persist in session** - reset on page refresh (could add localStorage later)
- **DEV-only feature** - already guarded by existing `import.meta.env.DEV` check
- **Collapsible section** - uses Radix Collapsible, default open

## Suggested Starting Values for Better Balance

Based on my earlier analysis, once you have the controls you can try:

| Parameter | Current | Try This |
|-----------|---------|----------|
| `maxBeside3Row` | 12 | 8 |
| `maxBeside2Row` | 6 | 4 |
| `threeRowThreshold` | 6 | 10 |
| `contentPhotosPerBlock` | 4 | 6 |

This should increase hero prominence from ~10% to ~18-22% of canvas.

