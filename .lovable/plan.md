
# Fix: Hero Layout Ignores Shape Setting

## Root Cause

The shape setting (`settings.shape`) is not propagated through the hero layout code path. Specifically:

```text
generateHeroLayout(settings.shape)
├── heroes.length === 0 → generateContentOnlyLayout(shape) ✅ Works
├── heroes.length === 1 → generateSingleHeroLayout() ❌ Missing shape
│   └── generateBlockBasedHeroLayout() ❌ Missing shape
│       └── buildContentRowsBlock() ← defaults to 'auto'
└── heroes.length > 1 → generateMultiHeroLayout() ❌ Missing shape
```

The content-only path respects shape, but **all hero paths ignore it**, always defaulting to `'auto'` which results in portrait-heavy layouts for 63 photos.

---

## Solution

Thread the `shape` parameter through all hero layout functions:

### Files to Modify

| File | Function | Change |
|------|----------|--------|
| `src/lib/heroLayout.ts` | `generateSingleHeroLayout` | Add `shape` parameter |
| `src/lib/heroLayout.ts` | `generateBlockBasedHeroLayout` | Add `shape` parameter, pass to `buildContentRowsBlock` |
| `src/lib/heroLayout.ts` | `generateMultiHeroLayout` | Add `shape` parameter |
| `src/lib/heroLayout.ts` | `generateHeroLayout` | Pass `settings.shape` to all sub-functions |

---

## Technical Changes

### 1. Update `generateSingleHeroLayout` Signature

```typescript
// Before (line ~1254)
function generateSingleHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning
): CollageLayout

// After
function generateSingleHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto'
): CollageLayout
```

### 2. Update `generateBlockBasedHeroLayout` Signature

```typescript
// Before (line ~1152)
function generateBlockBasedHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning
): CollageLayout | null

// After
function generateBlockBasedHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto'
): CollageLayout | null
```

### 3. Pass Shape to `buildContentRowsBlock` (line ~1210-1217)

```typescript
// Before
const block = buildContentRowsBlock(
  chunk,
  canvasWidth,
  gap,
  packPhotosIntoRegion,
  tuning.minPhotosPerRow
);

// After
const block = buildContentRowsBlock(
  chunk,
  canvasWidth,
  gap,
  packPhotosIntoRegion,
  tuning.minPhotosPerRow,
  shape  // ← Add shape parameter
);
```

### 4. Update Call Sites in `generateHeroLayout` (lines 1517-1533)

```typescript
// Before
if (heroes.length === 1) {
  return generateSingleHeroLayout(
    heroes[0], standards, BASE_WIDTH, gap, randomize, tuning
  );
}
return generateMultiHeroLayout(
  heroes, standards, BASE_WIDTH, gap, randomize
);

// After
if (heroes.length === 1) {
  return generateSingleHeroLayout(
    heroes[0], standards, BASE_WIDTH, gap, randomize, tuning, settings.shape
  );
}
return generateMultiHeroLayout(
  heroes, standards, BASE_WIDTH, gap, randomize, settings.shape
);
```

### 5. Update `generateMultiHeroLayout` (optional, for consistency)

Add `shape` parameter to influence content packing if needed in future.

---

## Expected Result

After this fix:
- With **Landscape** selected and a hero photo: collage produces wide rows, shorter overall height
- With **Portrait** selected: collage produces fewer photos per row, taller layout
- With **Square**: balanced rows targeting ~1:1 aspect
- With **Auto**: current behavior (organic shape from density)

The 63-photo test with "Landscape" and a hero should now produce a landscape-oriented collage instead of always portrait.
