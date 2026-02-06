

# V2 Layout Algorithm: Fresh Start

## Summary

Create a parallel v2 implementation of the collage layout algorithm that starts from first principles with a mathematical foundation. The v1 code remains untouched as the production path, while v2 provides a clean slate for experimentation.

---

## What We've Learned (Lessons from V1)

### What Works Well
1. **Basic row packing** - Given photos and a width, calculating row heights to fill exactly is straightforward algebra
2. **Unified scoring** - `scoreConfiguration()` provides consistent evaluation across layout types
3. **PhotoDimension abstraction** - Clean separation of layout math from PhotoItem state
4. **Statistical helpers** - `coefficientOfVariation`, `mean`, `variance` are reusable utilities
5. **Gap/spacing math** - Consistent handling of gaps between photos and rows

### What Doesn't Work
1. **Branching decision trees** - "if 1-row, else if 2-row, else 3-row" leads to special cases
2. **Hero-first structure** - Starting with "hero beside rows + content rows below" constrains the shape too early
3. **Row count as primary variable** - Forces awkward thresholds and clamping
4. **Coverage checks as rejection** - Post-hoc validation rejects otherwise valid layouts
5. **Fraction-based hero sizing** - `heroWidthFraction` leads to prominence issues

### Core UX Goals
- **No gaps/blank spaces** - Every pixel covered
- **Uniform spacing** - Consistent gap between all photos
- **Hero prominence** - Heroes should occupy ~15-25% of total canvas area (not just row width)
- **Multiple heroes** - Support 0, 1, 2+ hero photos
- **Organic variety** - Different layouts feel fresh, not templated
- **Shape compliance** - Respect user's landscape/portrait/square preference

---

## V2 Architectural Principles

### 1. Math-First, Not Branch-First
Instead of:
```typescript
if (rowMode === 1) { ... }
else if (rowMode === 2) { ... }
```

Use unified formulas parameterized by variables the algorithm can optimize.

### 2. Canvas-Level Thinking
Start with the canvas (width × height), not individual rows. Work backward from target aspect ratio.

### 3. Area Budgets, Not Width Fractions
Heroes get an **area budget** (e.g., 20% of canvas area). The algorithm figures out the geometry that achieves that.

### 4. Continuous Optimization Space
Instead of discrete row counts (1, 2, 3), treat layout as a continuous optimization problem with soft constraints.

### 5. Separation of Concerns
```text
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Pure Math (no layout concepts)                    │
│    - Statistics, geometry, optimization utilities           │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Layout Primitives (no hero/content concepts)      │
│    - "Pack N photos into rectangle" → cells + achieved dims │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Strategy (decides structure)                      │
│    - Allocates canvas regions, assigns photos to regions    │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: Entry Point                                       │
│    - generateCollageLayout() orchestrates the above         │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Scaffold V2 Structure

**Create folder structure:**
```text
src/lib/v2/
├── index.ts              # Entry point: generateCollageLayoutV2()
├── math.ts               # Pure math utilities (copy from layoutMath.ts)
├── pack.ts               # Rectangle packing primitive
├── strategy.ts           # Layout strategy selection
├── score.ts              # Unified scoring
└── types.ts              # V2-specific types
```

**Files to create:**
| File | Purpose |
|------|---------|
| `src/lib/v2/types.ts` | PhotoDimension, RegionSpec, LayoutCandidate |
| `src/lib/v2/math.ts` | Copy stats + geometry from layoutMath.ts |
| `src/lib/v2/pack.ts` | `packRectangle()` - single recursive packer |
| `src/lib/v2/score.ts` | `scoreLayout()` with area uniformity, shape penalty |
| `src/lib/v2/strategy.ts` | Canvas partitioning strategies |
| `src/lib/v2/index.ts` | `generateCollageLayoutV2()` orchestrator |

### Phase 2: Add UI Toggle

**Modify `DebugPanel.tsx`:**
- Add toggle switch: "V1 / V2" algorithm selector
- Pass selection up to Index.tsx via new callback

**Modify `Index.tsx`:**
- Add state: `algorithmVersion: 'v1' | 'v2'`
- In `regenerateCollage()`, call either `generateCollageLayout()` or `generateCollageLayoutV2()` based on selection

### Phase 3: Core V2 Algorithm (Initial Approach)

The key insight: instead of building "hero unit + content rows", think of the canvas as a **weighted area allocation problem**.

**Concept:**
```text
Given:
  - N photos with weights (hero=2.0, standard=1.0)
  - Target canvas aspect ratio (from shape setting)
  - Gap size

Find:
  - Cell rectangles that fill canvas with no gaps
  - Each cell's area ∝ its weight
  - Minimize area coefficient of variation (uniformity)
```

**Initial Strategy (Treemap-inspired):**
1. Calculate total weighted area budget
2. Divide canvas into regions proportional to weights
3. Use squarified treemap algorithm for balanced subdivision
4. Score on area uniformity + shape compliance

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/v2/types.ts` | Create | V2 type definitions |
| `src/lib/v2/math.ts` | Create | Copy pure math from layoutMath.ts |
| `src/lib/v2/pack.ts` | Create | Rectangle packing primitive |
| `src/lib/v2/score.ts` | Create | Layout scoring function |
| `src/lib/v2/strategy.ts` | Create | Canvas partitioning strategies |
| `src/lib/v2/index.ts` | Create | Entry point |
| `src/components/DebugPanel.tsx` | Modify | Add V1/V2 toggle |
| `src/pages/Index.tsx` | Modify | Wire up algorithm selection |

---

## Technical Details

### V2 Types (`src/lib/v2/types.ts`)
```typescript
export interface PhotoDimension {
  id: string;
  aspectRatio: number;
  weight: number;  // 1.0 = standard, 2.0 = hero
}

export interface RegionSpec {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutCandidate {
  cells: Array<RegionSpec & { photoId: string }>;
  canvasWidth: number;
  canvasHeight: number;
  score: number;
}
```

### Entry Point (`src/lib/v2/index.ts`)
```typescript
export function generateCollageLayoutV2(
  photos: PhotoItem[],
  settings: CollageSettings,
  options: { photoWeights?: Record<string, number>; randomize?: boolean }
): CollageLayout | null {
  // 1. Extract dimensions with weights
  // 2. Calculate target aspect from shape
  // 3. Try multiple strategies (treemap, row-based, hybrid)
  // 4. Score each candidate
  // 5. Return best (or random top-N if randomize)
}
```

### Pack Primitive (`src/lib/v2/pack.ts`)
```typescript
/**
 * Pack photos into a rectangle, returning cell positions.
 * This is the single recursive building block.
 * 
 * @param photos - Photos to pack
 * @param region - Available rectangle
 * @param gap - Gap between photos
 * @param direction - 'horizontal' | 'vertical' | 'auto'
 */
export function packRectangle(
  photos: PhotoDimension[],
  region: RegionSpec,
  gap: number,
  direction?: 'horizontal' | 'vertical' | 'auto'
): CollageCell[] {
  // Recursive subdivision or row-based packing
}
```

---

## Expected Outcome

After Phase 3:
- V2 toggle visible in dev mode debug panel
- Basic V2 layouts generating (may not be perfect initially)
- Clear separation of concerns for iterating on the algorithm
- V1 production code untouched

This sets the stage for rapid experimentation with mathematical approaches (treemaps, constraint solvers, gradient descent on area uniformity, etc.) without risk to the working v1 implementation.

