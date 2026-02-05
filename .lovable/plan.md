

# Layout Rating Tool Implementation

## Overview

Build an interactive rating UI at `/layout-rating` (dev-only) where you can quickly judge synthetic layout samples as "good" or "bad". The tool generates layouts using the real algorithm with synthetic photo data (aspect ratios only), visualizes them using CSS positioning, and captures your ratings for pattern analysis.

---

## Architecture

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         Layout Rating Tool                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │   Synthetic  │───>│   Layout     │───>│   Rating     │          │
│  │  Photo Gen   │    │  Algorithm   │    │     UI       │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                     │
│  Generates:          Runs actual:       Shows:                      │
│  - Aspect ratios     - collageLayout    - CSS grid viz              │
│  - Priority flags    - heroLayout       - Metrics badges            │
│  - Smart crop sim    - layoutBlocks     - Good/Bad buttons          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │                 Ratings Export                            │      │
│  │  - JSON download of all ratings                           │      │
│  │  - Copy to clipboard                                      │      │
│  │  - Session progress tracking                              │      │
│  └──────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Synthetic Photo Generator

### File: `src/test/layout/photoGenerator.ts`

```typescript
// Core type - just aspect ratio and priority, no image data
interface SyntheticPhoto {
  id: string;
  aspectRatio: number;
  priority: 1 | 2 | 3;
  // Simulated dimensions (aspect ratio is what matters)
  originalWidth: number;   // Needed for algorithm compatibility
  originalHeight: number;  // Derived: 1000 / aspectRatio
}

// Common ratios from real-world sources
const COMMON_RATIOS = {
  phone_landscape: 1.33,   // 4:3
  phone_portrait: 0.75,    // 3:4
  wide_landscape: 1.78,    // 16:9
  wide_portrait: 0.56,     // 9:16
  square: 1.0,             // 1:1
  dslr_landscape: 1.5,     // 3:2
  dslr_portrait: 0.67,     // 2:3
};

// Smart crop simulation: moves ratio 10-30% toward square (1.0)
function applySmartCropVariation(baseAspect: number): number;

// Distribution presets (weighted toward common cases)
type AspectDistribution = 
  | 'phone-mix'    // 70% portrait (3:4), 30% landscape (4:3)
  | 'social-mix'   // Mix of 1:1, 4:5, 16:9
  | 'camera-mix'   // 60% 3:2 landscape, 40% 2:3 portrait
  | 'balanced';    // Equal mix of all common ratios

function generatePhotoSet(
  count: number,
  distribution: AspectDistribution,
  hasHero: boolean,
  smartCropRatio?: number  // Default 0.7 (70% get smart crop variation)
): SyntheticPhoto[];
```

**Why include originalWidth/originalHeight?**
The layout algorithm uses `PhotoItem` which expects these fields. We set a fixed width (1000px) and derive height from aspect ratio. The algorithm only uses the ratio, but needs the fields for type compatibility.

---

## Phase 2: Layout Adapter

### File: `src/test/layout/layoutAdapter.ts`

Wraps the real layout algorithm to work with synthetic photos:

```typescript
import { generateCollageLayout } from '@/lib/collageLayout';
import { CollageLayout, CollageSettings, LayoutTuning } from '@/types/collage';

interface LayoutTestCase {
  photos: SyntheticPhoto[];
  shape: CollageSettings['shape'];
  hasHero: boolean;
  distribution: AspectDistribution;
  tuning?: Partial<LayoutTuning>;
}

interface LayoutTestResult {
  // Test case inputs
  testCase: LayoutTestCase;
  
  // Raw layout output
  layout: CollageLayout;
  
  // Computed metrics for analysis
  rowCount: number;
  rowSizes: number[];           // Photos per row
  canvasAspect: number;         // width / height
  areaCoefficientOfVariation: number;  // Size uniformity
  largestToSmallestRatio: number;
  heroCoverage: number | null;  // % of canvas area hero occupies
}

// Convert synthetic photos to PhotoItem format for algorithm
function syntheticToPhotoItem(photo: SyntheticPhoto): PhotoItem;

// Run layout and compute metrics
function runLayoutTest(testCase: LayoutTestCase): LayoutTestResult;

// Generate a batch of diverse test cases
function generateTestBatch(count: number): LayoutTestCase[];
```

---

## Phase 3: Rating UI Component

### File: `src/pages/LayoutRating.tsx`

Full-screen rating interface with keyboard shortcuts:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Layout Rating Tool                                    [12 / 50]    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │   ┌─────────────┬──────┬──────┬──────┐                     │   │
│  │   │             │      │      │      │                     │   │
│  │   │   HERO ★    │ 3:4  │ 4:3  │ 1:1  │                     │   │
│  │   │   (1.5)     │      │      │      │                     │   │
│  │   │             ├──────┴──────┴──────┤                     │   │
│  │   │             │ 0.75 │ 0.67 │ 1.33 │                     │   │
│  │   └─────────────┴──────┴──────┴──────┘                     │   │
│  │                                                             │   │
│  │   ┌──────────────────────────────────┐                     │   │
│  │   │  0.8  │  1.2  │  0.9  │  1.1     │  ← Content rows    │   │
│  │   └──────────────────────────────────┘                     │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Photos: 12  │  Shape: Portrait  │  Hero: Yes  │  Rows: 4  │   │
│  │  Canvas: 0.72  │  Area CV: 0.28  │  Size ratio: 2.3x       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────┐     │
│  │    👎 Bad        │    │    👍 Good       │    │   Skip   │     │
│  │   (press B)      │    │   (press G)      │    │  (S)     │     │
│  └──────────────────┘    └──────────────────┘    └──────────┘     │
│                                                                     │
│  [← Prev]  [Export JSON]  [Copy Stats]  [Next →]                   │
└─────────────────────────────────────────────────────────────────────┘
```

### Layout Visualization Component

Each cell rendered with:
- Background color (pastel, unique per photo)
- Aspect ratio label (e.g., "0.75")
- Hero indicator (★ icon + amber border)
- Position matching exact algorithm output

```typescript
function LayoutVisualization({ layout, photos }: Props) {
  return (
    <div
      className="relative mx-auto border border-border rounded-lg overflow-hidden"
      style={{
        aspectRatio: `${layout.width} / ${layout.height}`,
        maxHeight: '50vh',
      }}
    >
      {layout.cells.map((cell, index) => {
        const photo = photos.find(p => p.id === cell.photoId);
        const isHero = photo?.priority === 1;
        
        return (
          <div
            key={cell.photoId}
            className={cn(
              "absolute flex items-center justify-center text-xs font-mono",
              "border border-white/30",
              isHero && "ring-2 ring-amber-400"
            )}
            style={{
              left: `${(cell.x / layout.width) * 100}%`,
              top: `${(cell.y / layout.height) * 100}%`,
              width: `${(cell.width / layout.width) * 100}%`,
              height: `${(cell.height / layout.height) * 100}%`,
              backgroundColor: getPastelColor(index),
            }}
          >
            {isHero && <Star className="h-3 w-3 mr-1 fill-amber-400" />}
            {photo?.aspectRatio.toFixed(2)}
          </div>
        );
      })}
    </div>
  );
}
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| G | Rate as Good |
| B | Rate as Bad |
| S | Skip (neither) |
| ← | Previous layout |
| → | Next layout |

### Rating Data Structure

```typescript
interface RatedLayout {
  // Inputs
  photoCount: number;
  distribution: AspectDistribution;
  shape: 'auto' | 'landscape' | 'portrait' | 'square';
  hasHero: boolean;
  
  // Layout metrics
  rowCount: number;
  rowSizes: number[];
  canvasAspect: number;
  areaCoefficientOfVariation: number;
  largestToSmallestRatio: number;
  heroCoverage: number | null;
  
  // Your rating
  rating: 'good' | 'bad' | 'skip';
  
  // Timestamp for session tracking
  ratedAt: string;
}
```

---

## Phase 4: Test Case Generation

### Photo Count Selection

Based on your feedback, using counts that expose edge cases:

```typescript
const PHOTO_COUNTS = [3, 5, 7, 9, 12, 17, 23, 35, 50];
```

**Why these numbers:**
- **3, 5**: Small sets where every photo matters
- **7**: First prime that forces uneven row splits
- **9**: Just above 8 (power of 2), tests divisibility
- **12**: Highly divisible (2×6, 3×4, 4×3)
- **17**: Prime, awkward to balance in rows
- **23**: Prime, medium-sized challenge
- **35**: 5×7, tests larger grid patterns
- **50**: Upper bound stress test

### Distribution Strategy

Weight toward common cases:

```typescript
function generateTestBatch(totalCount: number): LayoutTestCase[] {
  const cases: LayoutTestCase[] = [];
  
  // Weighted distribution of test cases
  const weights = {
    'phone-mix': 0.35,    // Most common (phone photos)
    'balanced': 0.30,     // Good variety
    'social-mix': 0.25,   // Instagram imports
    'camera-mix': 0.10,   // DSLR (less common)
  };
  
  // For each photo count, generate cases across shapes and hero modes
  for (const count of PHOTO_COUNTS) {
    for (const shape of ['auto', 'landscape', 'portrait', 'square']) {
      for (const hasHero of [true, false]) {
        // Pick distribution based on weights
        const distribution = weightedRandomPick(weights);
        cases.push({ 
          photos: generatePhotoSet(count, distribution, hasHero),
          shape,
          hasHero,
          distribution,
        });
      }
    }
  }
  
  // Shuffle for variety in rating session
  return shuffleArray(cases);
}
```

---

## File Structure

```text
src/
├── test/
│   └── layout/
│       ├── photoGenerator.ts   # Synthetic photo generation
│       ├── layoutAdapter.ts    # Algorithm wrapper + metrics
│       └── types.ts            # Shared types for test framework
│
├── pages/
│   └── LayoutRating.tsx        # Rating UI page
│
├── components/
│   └── layout-rating/
│       ├── LayoutVisualization.tsx   # CSS grid layout display
│       ├── MetricsBadges.tsx         # Stats display row
│       └── RatingControls.tsx        # Buttons + keyboard handler
│
└── App.tsx                     # Add route (dev-only)
```

---

## Route Registration

### File: `src/App.tsx`

Add dev-only route:

```typescript
import LayoutRating from "./pages/LayoutRating";

// Inside Routes:
{import.meta.env.DEV && (
  <Route path="/layout-rating" element={<LayoutRating />} />
)}
```

---

## Session Flow

1. Navigate to `/layout-rating`
2. First test case loads with random photo set
3. View layout visualization + metrics
4. Press G (good), B (bad), or S (skip)
5. Next case loads automatically
6. Progress bar shows completion
7. Export JSON when done (or anytime)

---

## Export Format

```json
{
  "sessionId": "2026-02-05T12:34:56Z",
  "totalRated": 47,
  "ratings": [
    {
      "photoCount": 12,
      "distribution": "phone-mix",
      "shape": "portrait",
      "hasHero": true,
      "rowCount": 4,
      "rowSizes": [1, 4, 4, 3],
      "canvasAspect": 0.72,
      "areaCoefficientOfVariation": 0.28,
      "largestToSmallestRatio": 2.3,
      "heroCoverage": 0.25,
      "rating": "good",
      "ratedAt": "2026-02-05T12:35:12Z"
    },
    // ... more ratings
  ],
  "summary": {
    "goodCount": 35,
    "badCount": 10,
    "skipCount": 2
  }
}
```

---

## Implementation Order

1. **Types** (`src/test/layout/types.ts`) - Shared interfaces
2. **Photo Generator** (`src/test/layout/photoGenerator.ts`) - Synthetic data
3. **Layout Adapter** (`src/test/layout/layoutAdapter.ts`) - Algorithm wrapper
4. **Visualization** (`src/components/layout-rating/LayoutVisualization.tsx`)
5. **Rating Page** (`src/pages/LayoutRating.tsx`) - Full UI
6. **Route** (`src/App.tsx`) - Dev-only registration

---

## Technical Notes

- Uses real `generateCollageLayout` algorithm - no mocking
- Synthetic photos converted to `PhotoItem` format for compatibility
- All metrics computed from actual layout output
- Session state persisted to localStorage (survives refresh)
- Export includes all data needed for rule extraction
- Keyboard shortcuts for rapid rating (5-10 min for 50 samples)

