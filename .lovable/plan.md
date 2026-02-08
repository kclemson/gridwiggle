
# Hero Resize: Normalized Layout as Source of Truth

## Design Intent

Instead of storing pixel coordinates and running a full re-pack when the user drags the hero slider, we store the layout in **normalized space** and compute pixel coordinates on-demand. When the slider changes the hero scale, we reflow the normalized math and re-derive pixels — no search, no shuffling.

## User Outcome

- Drag hero slider → hero grows/shrinks relative to content
- **Same photos** in same positions (BESIDE vs BELOW)
- **Same row assignments** — only dimensions change
- Smooth, instant feedback (no async worker call)
- Export uses the scaled dimensions

---

## Core Insight: What "Hero Scale" Changes

In normalized space, the hero's "size" is determined by its **aspect ratio**:

```text
heroWidth = heroAR × heroHeight  (where heroHeight = 1.0)
```

**Scaling the hero** = changing its effective AR:

```text
scaledHeroAR = heroAR × heroScale
```

This changes:
1. Hero row width = `scaledHeroAR + gap + besideWidth`
2. BELOW packs to new width → different row heights
3. Canvas height = 1 + gap + newBelowHeight

But **photo assignments don't change** — same photos in BESIDE, same in BELOW.

---

## Architecture Change

### Before (Current)
```text
┌─────────────────────────────────────────────────┐
│ Layout Worker                                   │
│  ├── findValidConfiguration (search + pack)    │
│  └── return pixelCells, pixelWidth, pixelHeight │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ CollageLayout (stored in state)                 │
│  width: 1234px, height: 567px                   │
│  cells: [{ x: 12px, y: 34px, ... }]            │
└─────────────────────────────────────────────────┘
```

### After (New)
```text
┌─────────────────────────────────────────────────┐
│ Layout Worker                                   │
│  ├── findValidConfiguration (search + pack)    │
│  └── return normalizedLayout + pixelScale      │
└─────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────┐
│ NormalizedLayout (stored in state)              │
│  normalizedWidth: 1.234                         │
│  normalizedHeight: 0.567                        │
│  normalizedCells: [{ x: 0.012, y: 0.034, ... }]│
│  metadata: {                                    │
│    heroId, heroPosition, normalizedGap,         │
│    besidePhotoIds, belowPhotoIds,               │
│    besideRowCount, belowRowCount               │
│  }                                              │
└─────────────────────────────────────────────────┘
         ↓ (on-demand)
┌─────────────────────────────────────────────────┐
│ Pixel Conversion (useMemo or function)          │
│  pixelScale = 1000 (or derived from container) │
│  pixelCells = normalizedCells × pixelScale     │
└─────────────────────────────────────────────────┘
```

---

## The Reflow Function

When hero scale changes, we **reflow** using stored metadata:

```typescript
function reflowWithHeroScale(
  photos: PhotoDimension[],
  metadata: LayoutMetadata,
  heroScale: number,
  normalizedGap: number,
  tuning: V3Tuning
): NormalizedLayout {
  // 1. Find hero and compute scaled AR
  const heroPhoto = photos.find(p => p.id === metadata.heroId);
  const scaledHeroAR = heroPhoto.aspectRatio * heroScale;
  
  // 2. Get BESIDE photos in stored order
  const besidePhotos = metadata.besidePhotoIds
    .map(id => photos.find(p => p.id === id))
    .filter(Boolean);
  
  // 3. Get BELOW photos in stored order  
  const belowPhotos = metadata.belowPhotoIds
    .map(id => photos.find(p => p.id === id))
    .filter(Boolean);
  
  // 4. Repack BESIDE at height=1 with SAME row count
  const besideResult = packToFillHeight(
    besidePhotos,
    1.0,
    normalizedGap,
    metadata.besideRowCount,  // Preserved!
    tuning,
    false  // No shuffle
  );
  
  // 5. Compute new hero row width
  const heroRowWidth = scaledHeroAR + 
    (besidePhotos.length > 0 ? normalizedGap + besideResult.width : 0);
  
  // 6. Repack BELOW at new width with SAME row count
  const belowResult = packToFillWidth(
    belowPhotos,
    heroRowWidth,
    normalizedGap,
    metadata.belowRowCount,  // Preserved!
    tuning,
    false  // No shuffle
  );
  
  // 7. Convert to normalized cells
  const cells = convertToNormalized(
    heroPhoto,
    metadata.heroPosition,
    scaledHeroAR,
    besideResult.cells,
    belowResult.cells,
    belowResult.height,
    normalizedGap,
    heroRowWidth
  );
  
  return {
    normalizedWidth: heroRowWidth + 2 * normalizedGap,
    normalizedHeight: 1.0 + normalizedGap + belowResult.height + 2 * normalizedGap,
    normalizedCells: cells,
    metadata: { ...metadata }, // Unchanged
  };
}
```

---

## Key Properties

| Property | Preserved | Changes |
|----------|-----------|---------|
| BESIDE photo IDs | Yes | No |
| BELOW photo IDs | Yes | No |
| BESIDE row count | Yes | No |
| BELOW row count | Yes | No |
| Hero position (corner) | Yes | No |
| Hero width | No | Scales with slider |
| BESIDE region width | No | Adjusts to fill height=1 |
| BELOW row heights | No | Adjusts to fill new width |
| Canvas aspect ratio | No | Derived from new geometry |

---

## Data Model Changes

### `CollageLayout` (src/types/collage.ts)

Add normalized layout storage:

```typescript
interface NormalizedLayout {
  /** Canvas width in normalized units (hero height = 1) */
  normalizedWidth: number;
  /** Canvas height in normalized units */
  normalizedHeight: number;
  /** Cells in normalized coordinates */
  normalizedCells: NormalizedCell[];
  /** Layout topology for reflow */
  metadata: LayoutMetadata;
}

interface LayoutMetadata {
  heroId: string | null;
  heroPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  normalizedGap: number;
  besidePhotoIds: string[];
  belowPhotoIds: string[];
  besideRowCount: number;
  belowRowCount: number;
}

/** Extend existing CollageLayout */
interface CollageLayout {
  width: number;
  height: number;
  cells: CollageCell[];
  /** Normalized layout for reflow operations */
  normalized?: NormalizedLayout;
}
```

### Worker Response Changes

The worker already returns normalized cells internally — we just expose them:

```typescript
interface LayoutResponse {
  // ... existing fields
  normalized?: {
    width: number;
    height: number;
    cells: NormalizedCell[];
    metadata: LayoutMetadata;
  };
}
```

---

## Implementation Steps

### 1. Add Types (src/types/collage.ts)
- Add `NormalizedLayout`, `LayoutMetadata` interfaces
- Extend `CollageLayout` with optional `normalized` field

### 2. Capture Metadata in intersection.ts
- In `evaluateNormalizedProposal`, construct and return `LayoutMetadata`
- Include heroId, position, gap, photo ID lists, row counts

### 3. Return Normalized Data from Worker
- In `layoutWorker.ts`, include `normalized` in response
- Store both normalized and pixel versions

### 4. Create Reflow Function (src/lib/v3/reflow.ts)
- `reflowWithHeroScale(photos, metadata, heroScale, gap, tuning)`
- Uses stored row counts — deterministic, no search
- Returns new `NormalizedLayout`

### 5. Update Index.tsx
- Store `normalized` from layout response
- On slider drag: call synchronous `reflowWithHeroScale`
- Convert to pixels for display using `VIRTUAL_CANVAS_BASE`
- On slider commit: persist the new normalized layout

### 6. Update CollagePreview/Export
- Use pixel coordinates as before (derived from normalized × scale)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/collage.ts` | Add `NormalizedLayout`, `LayoutMetadata` |
| `src/lib/v3/types.ts` | Add/export metadata types if needed |
| `src/lib/v3/intersection.ts` | Return metadata from `evaluateNormalizedProposal` |
| `src/lib/v3/reflow.ts` | **NEW** — Reflow function |
| `src/workers/layoutWorker.ts` | Return normalized layout + metadata |
| `src/services/layoutGenerationService.ts` | Pass through normalized data |
| `src/pages/Index.tsx` | Use synchronous reflow for hero slider |
| `src/components/HeroProminenceSlider.tsx` | Update to hero scale semantics |

---

## Performance Characteristics

| Operation | Current | After |
|-----------|---------|-------|
| Initial layout | ~10-50ms (worker) | ~10-50ms (worker) — unchanged |
| Hero slider drag | ~10-50ms (worker, async) | **~0.5-2ms (sync, reflow only)** |
| Photo swap | Uses existing reflow | Uses existing reflow |

The slider becomes **dramatically more responsive** because we skip:
- Worker message overhead
- Constraint search (region assignment)
- Random row count selection
- All validation checks (topology is pre-validated)

---

## Edge Cases

1. **No hero**: Metadata has `heroId: null`, slider is disabled — no change needed
2. **Hero changed**: Full regeneration (new search) — metadata invalidated
3. **Photo removed**: Full regeneration — metadata invalidated
4. **Old layouts without metadata**: Fall back to current regeneration behavior
5. **Extreme scales**: May violate canvas AR bounds — show as soft rejection

---

## Visual Behavior

1. Generate collage → normalized layout stored with metadata
2. Drag hero slider → `reflowWithHeroScale` called synchronously
3. Hero grows/shrinks → BESIDE/BELOW adjust instantly
4. **No shuffle** — same photos, same order, just different sizes
5. Release slider → normalized layout committed to state
6. Export uses pixel dimensions derived from normalized × 1000
