

# V3 Layout Engine: First-Principles Architecture

## Overview

V3 replaces row-first thinking with **constraint intersection** and **sub-rectangle decomposition**. A hero photo "carves" the canvas into 2-4 sub-rectangles, each solved independently. Row counts and photo distribution are **derived from geometry**, not specified as tuning parameters.

---

## Minimal V3Tuning (8 Parameters)

```typescript
interface V3Tuning {
  // === Hero Prominence ===
  hero_minProminence: number;       // Floor: reject if below (1.3)
  hero_targetProminence: number;    // Target for sizing math (1.5)
  
  // === Region Viability ===
  region_minHeight: number;         // Minimum height in pixels (80)
  region_minWidth: number;          // Minimum width in pixels (80)
  
  // === Decomposition Thresholds ===
  decomp_edgeMinPhotos: number;     // Min photos for edge placement (8)
  decomp_floatingMinPhotos: number; // Min photos for floating (15)
  
  // === Final Equalization ===
  row_flexPercent: number;          // Smartcrop slack for row heights (0.10)
}

const DEFAULT_V3_TUNING: V3Tuning = {
  hero_minProminence: 1.3,
  hero_targetProminence: 1.5,
  region_minHeight: 80,
  region_minWidth: 80,
  decomp_edgeMinPhotos: 8,
  decomp_floatingMinPhotos: 15,
  row_flexPercent: 0.10,
};
```

**What we removed**: `maxPhotosPerRow`, `minPhotosPerRow`, `targetPhotosPerRow`, `row_maxCount`, all `score_*` weights, `hero_strongProminence`. These are either derivable from geometry or premature optimization.

---

## Module I/O Specification

### Canvas Entity

**NEEDS (Required Inputs)**
| Input | Type | Source |
|-------|------|--------|
| canvasWidth | number | Caller (container width) |
| gap | number | CollageSettings |
| heroRect | RegionSpec | From Hero Entity |
| mode | 'corner' \| 'edge' \| 'floating' | From Hero Entity |

**SENDS (Outputs)**
| Output | Type | Description |
|--------|------|-------------|
| regions | RegionSpec[] | 2-4 content regions after hero carves space |
| valid | boolean | Whether all regions meet minimum viability |

**MIGHT WANT (Tuning)**
| Param | Used For |
|-------|----------|
| region_minHeight | Reject regions too short for any photo |
| region_minWidth | Reject regions too narrow |

---

### Hero Entity

**NEEDS (Required Inputs)**
| Input | Type | Source |
|-------|------|--------|
| heroAR | number | Hero photo's aspect ratio |
| canvasWidth | number | From caller |
| contentStats | ContentStats | From ContentPool (mean AR, count) |

**SENDS (Outputs)**
| Output | Type | Description |
|--------|------|-------------|
| heroRect | RegionSpec | Derived dimensions and position |
| proposals | HeroProposal[] | Viable positions with decomposition modes |

**MIGHT WANT (Tuning)**
| Param | Used For |
|-------|----------|
| hero_minProminence | Validate final layout meets floor |
| hero_targetProminence | Derive hero area from content estimate |
| decomp_edgeMinPhotos | Gate edge placement proposals |
| decomp_floatingMinPhotos | Gate floating placement proposals |

**Hero Sizing Math** (no width fractions needed):
```
estContentArea = derived from content AR geometry
targetHeroArea = estContentArea * hero_targetProminence
heroHeight = sqrt(targetHeroArea / heroAR)
heroWidth = heroHeight * heroAR
```

---

### ContentPool Entity

**NEEDS (Required Inputs)**
| Input | Type | Source |
|-------|------|--------|
| photos | PhotoDimension[] | Non-hero photos |
| regions | RegionSpec[] | From Canvas decomposition |

**SENDS (Outputs)**
| Output | Type | Description |
|--------|------|-------------|
| stats | ContentStats | { count, meanAR, arVariance } |
| distribution | PhotoDistribution | Photos assigned to regions |
| cells | LayoutCell[] | Final positioned cells |

**MIGHT WANT (Tuning)**
| Param | Used For |
|-------|----------|
| region_minHeight | Viability check for regions |
| row_flexPercent | Final row height equalization |

**Row Count Derivation** (no explicit row params needed):
- Region height and photo ARs determine natural row count
- `region_minWidth` implicitly caps photos-per-row (can't fit more if cells get too narrow)
- Row packing optimizes for equal-height rows within each region

---

### Intersection Engine

**NEEDS (Required Inputs)**
| Input | Type | Source |
|-------|------|--------|
| canvas | CanvasEntity | Constructed with width/gap |
| hero | HeroEntity | Constructed with hero photo |
| contentPool | ContentPoolEntity | Constructed with content photos |
| tuning | V3Tuning | From caller |

**SENDS (Outputs)**
| Output | Type | Description |
|--------|------|-------------|
| layout | CollageLayout \| null | Best valid configuration, or null if none found |

**Algorithm**:
1. Hero proposes positions based on content count thresholds
2. For each proposal: decompose canvas, check region viability, distribute content
3. Validate prominence: heroArea / runnerUpArea >= hero_minProminence
4. Return best valid config (or null - no silent fallbacks)

---

## Sub-Rectangle Decomposition

### Corner Placement (2 regions)
Default for any photo count. Hero in corner, content beside and below.

```text
+------------------+--------+
|                  |        |
|      HERO        | BESIDE |
|                  |        |
+------------------+--------+
|                           |
|          BELOW            |
|                           |
+---------------------------+
```

### Edge Placement (3 regions)
Requires decomp_edgeMinPhotos (8+). Hero on edge with content above, beside, below.

```text
+---------------------------+
|           TOP             |
+--------+------------------+
|        |                  |
| BESIDE |      HERO        |
|        |                  |
+--------+------------------+
|          BELOW            |
+---------------------------+
```

### Floating Placement (4 regions)
Requires decomp_floatingMinPhotos (15+). Hero centered with content on all sides.

```text
+---------------------------+
|           TOP             |
+--------+----------+-------+
|  LEFT  |   HERO   | RIGHT |
+--------+----------+-------+
|         BOTTOM            |
+---------------------------+
```

---

## File Structure

```text
src/lib/v3/
  index.ts              # Entry: generateCollageLayoutV3()
  types.ts              # V3Tuning, RegionSpec, HeroProposal, ContentStats
  entities/
    canvas.ts           # Canvas decomposition
    hero.ts             # Prominence sizing + position proposals
    content-pool.ts     # Stats, viability, distribution
  intersection.ts       # Constraint intersection engine
  row-pack.ts           # Row packing within regions
  utils.ts              # Shared math (reuse from v2 where applicable)
```

---

## Implementation Phases

### Phase 1: Foundation
- Create src/lib/v3/ directory structure
- Implement V3Tuning interface and DEFAULT_V3_TUNING
- Implement core types (RegionSpec, HeroProposal, ContentStats, PhotoDistribution)
- Implement Canvas entity with corner decomposition only
- Implement Hero entity with prominence-derived sizing
- Implement ContentPool with basic stats and single-region row-packing
- Wire up entry point returning corner-placement layouts

### Phase 2: Edge Placement
- Extend Canvas.decompose() for 3-region splits
- Add edge position proposals to Hero entity
- Implement multi-region distribution in ContentPool
- Update intersection engine for edge proposals

### Phase 3: Floating Placement
- Extend Canvas.decompose() for 4-region splits
- Add floating position proposals to Hero entity
- Derive hero Y position from surrounding region needs
- Full constraint intersection with all decomposition modes

### Phase 4: Equalization and Polish
- Apply row_flexPercent for final row height equalization
- Add AR diversity optimization to distribution
- Integration testing with real photo sets

### Phase 5: Integration
- Add V3 toggle to debug panel
- Comparison tool (V2 vs V3 side-by-side)
- Tune defaults based on rating feedback
- Documentation

---

## Design Principles

| Principle | Implementation |
|-----------|----------------|
| Derive, don't specify | Row counts come from geometry, not tuning params |
| Minimal tuning | 8 params that each serve a clear purpose |
| No silent fallbacks | Return null if no valid config; let failures surface |
| First-principles I/O | Each module declares exactly what it needs/sends |
| Add params when needed | Start minimal, add only when we discover genuine need |

---

## Files to Create

| File | Purpose |
|------|---------|
| src/lib/v3/types.ts | V3Tuning, RegionSpec, HeroProposal, ContentStats, PhotoDistribution |
| src/lib/v3/entities/canvas.ts | Canvas decomposition logic |
| src/lib/v3/entities/hero.ts | Hero sizing and position proposals |
| src/lib/v3/entities/content-pool.ts | Content stats and distribution |
| src/lib/v3/intersection.ts | Constraint intersection algorithm |
| src/lib/v3/row-pack.ts | Row packing within regions |
| src/lib/v3/utils.ts | Shared math utilities |
| src/lib/v3/index.ts | Entry point: generateCollageLayoutV3() |

