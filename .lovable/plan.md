

# Make Shape Indicator Highly Visible in Layout Rating Tool

## Problem

The requested shape (landscape/portrait/square/auto) is buried among many small badges, making it easy to overlook when rating. Users accidentally rate layouts as "good" before realizing the shape doesn't match expectations.

---

## Solution

Add a prominent shape indicator banner directly above the layout visualization, separate from the detailed metrics badges.

---

## Design

```text
┌─────────────────────────────────────────────────────────────┐
│                    LANDSCAPE                                │  ← Large, colored banner
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                  [Layout Visualization]                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Visual treatment:**
- Full-width banner with shape-specific background color
- Large, bold text (e.g., "LANDSCAPE", "PORTRAIT", "SQUARE")
- Color coding for instant recognition:
  - Landscape → Blue tint
  - Portrait → Purple tint  
  - Square → Green tint
  - Auto → Gray/neutral

---

## Changes

### File: `src/pages/LayoutRating.tsx`

Add a shape banner component inline (or create a small component) that renders above the layout card:

```tsx
{/* Shape indicator banner */}
<div className={cn(
  "text-center py-2 px-4 rounded-lg font-bold text-lg uppercase tracking-wider",
  currentResult.testCase.shape === 'landscape' && "bg-blue-500/20 text-blue-400",
  currentResult.testCase.shape === 'portrait' && "bg-purple-500/20 text-purple-400",
  currentResult.testCase.shape === 'square' && "bg-green-500/20 text-green-400",
  currentResult.testCase.shape === 'auto' && "bg-muted text-muted-foreground",
)}>
  {currentResult.testCase.shape}
</div>

{/* Layout visualization */}
<div className="bg-card rounded-lg p-4 border">
  <LayoutVisualization ... />
</div>
```

### File: `src/components/layout-rating/MetricsBadges.tsx`

Remove the shape badge from here since it's now prominently displayed above (optional cleanup to reduce redundancy).

---

## Implementation

1. Add shape banner with color-coded background in `LayoutRating.tsx`
2. Optionally remove duplicate shape badge from `MetricsBadges.tsx`

