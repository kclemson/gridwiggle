

# Add Issue/Quality Checkboxes to Layout Rating Tool

## Overview

Add always-visible checkboxes for categorizing layout issues and positives. Multiple selections allowed, enabling structured data capture for programmatic analysis.

---

## Checkbox Categories

### Issues (for "Bad" ratings)
| ID | Label | Description |
|----|-------|-------------|
| `hero-not-prominent` | Hero not prominent | Hero photo doesn't stand out enough |
| `hero-too-dominant` | Hero too dominant | Hero takes up too much canvas |
| `single-photo-row` | Single-photo row | Awkward row with just one photo |
| `row-too-dense` | Row too dense | Too many photos crammed in a row |
| `uneven-sizes` | Uneven sizes | Photos have wildly different areas |
| `wrong-shape` | Wrong shape | Canvas doesn't match requested shape |
| `wasted-space` | Wasted space / gaps | Blank areas or inefficient packing |

### Positives (for "Good" ratings)
| ID | Label | Description |
|----|-------|-------------|
| `well-balanced` | Well balanced | Even distribution of photo sizes |
| `hero-works` | Hero works well | Hero is appropriately prominent |
| `good-variety` | Good variety | Nice mix of row sizes/arrangements |

---

## Changes

### 1. Update Types (`src/test/layout/types.ts`)

```typescript
// Add tag constants
export const LAYOUT_ISSUE_TAGS = [
  'hero-not-prominent',
  'hero-too-dominant', 
  'single-photo-row',
  'row-too-dense',
  'uneven-sizes',
  'wrong-shape',
  'wasted-space',
] as const;

export const LAYOUT_POSITIVE_TAGS = [
  'well-balanced',
  'hero-works',
  'good-variety',
] as const;

export type LayoutTag = 
  | typeof LAYOUT_ISSUE_TAGS[number] 
  | typeof LAYOUT_POSITIVE_TAGS[number];

// Update RatedLayout interface
interface RatedLayout {
  // ... existing fields ...
  rating: 'good' | 'bad' | 'skip';
  tags: LayoutTag[];  // Selected checkboxes
  ratedAt: string;
}
```

### 2. New Component: `TagCheckboxes.tsx`

```typescript
// src/components/layout-rating/TagCheckboxes.tsx

interface TagCheckboxesProps {
  selectedTags: LayoutTag[];
  onTagsChange: (tags: LayoutTag[]) => void;
}

// Renders two columns:
// Left: Issues (problems to flag)
// Right: Positives (qualities to note)
// Uses Checkbox component from ui/checkbox
```

**UI Layout:**
```text
┌─────────────────────────────────────────────────────────────┐
│  Issues                      │  Positives                  │
│  ☐ Hero not prominent        │  ☐ Well balanced            │
│  ☐ Hero too dominant         │  ☐ Hero works well          │
│  ☐ Single-photo row          │  ☐ Good variety             │
│  ☐ Row too dense             │                             │
│  ☐ Uneven sizes              │                             │
│  ☐ Wrong shape               │                             │
│  ☐ Wasted space              │                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Update RatingControls

- Add `selectedTags` and `onTagsChange` props
- Render `TagCheckboxes` component above rating buttons

### 4. Update LayoutRating Page

- Add `selectedTags` state: `useState<LayoutTag[]>([])`
- Pass to RatingControls
- Include in RatedLayout when submitting
- Clear after each rating

---

## File Structure

```text
src/
├── test/layout/
│   └── types.ts                    # Add tag types and constants
│
└── components/layout-rating/
    ├── TagCheckboxes.tsx           # NEW - Checkbox grid component
    ├── RatingControls.tsx          # Add tags props, render TagCheckboxes
    └── ...
```

---

## Export Format Update

```json
{
  "ratings": [
    {
      "photoCount": 12,
      "shape": "portrait",
      "rating": "bad",
      "tags": ["hero-not-prominent", "uneven-sizes"],
      "ratedAt": "2026-02-05T12:35:12Z"
    }
  ]
}
```

---

## Implementation Order

1. Update types with tag constants and types
2. Create TagCheckboxes component
3. Wire into RatingControls
4. Update LayoutRating page state management

