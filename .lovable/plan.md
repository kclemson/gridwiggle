

# Plan: Dynamic Tag Labels with Real-Time Layout Metrics

## Summary

Enhance the tag checkbox labels to display relevant metrics from the current layout, making it easier to assess issues like "wrong shape" or "hero not prominent" at a glance.

## Dynamic Labels

| Tag | Current Label | Enhanced Label |
|-----|---------------|----------------|
| `wrong-shape` | Wrong shape | Wrong shape (0.67) |
| `hero-not-prominent` | Hero not prominent | Hero not prominent (18% vs 15/12/11%) |
| `hero-too-dominant` | Hero too dominant | Hero too dominant (45% · 3.2×) |
| `extreme-aspect` | Extreme aspect | Extreme aspect (0.42) |
| `row-too-dense` | Row too dense | Row too dense ([1, 5, 4]) |
| `single-photo-row` | Single-photo row | Single-photo row ([1, 3, 2]) |
| `uneven-sizes` | Uneven sizes | Uneven sizes (4.2×) |

Labels for tags without relevant metrics (`wasted-space`, `well-balanced`, `hero-works`) remain static.

## Changes

### 1. `src/components/layout-rating/RatingControls.tsx`

Add a new prop to pass the layout result:

```typescript
interface RatingControlsProps {
  // ... existing props ...
  result: LayoutTestResult;  // NEW
}
```

Pass it through to TagCheckboxes:

```tsx
<TagCheckboxes 
  selectedTags={selectedTags} 
  onTagsChange={onTagsChange}
  result={result}  // NEW
/>
```

### 2. `src/pages/LayoutRating.tsx`

Pass `currentResult` to RatingControls:

```tsx
<RatingControls
  // ... existing props ...
  result={currentResult}  // NEW
/>
```

### 3. `src/components/layout-rating/TagCheckboxes.tsx`

Accept the result prop and generate dynamic labels:

```typescript
interface TagCheckboxesProps {
  selectedTags: LayoutTag[];
  onTagsChange: (tags: LayoutTag[]) => void;
  result: LayoutTestResult;  // NEW
}

// Generate dynamic label based on tag and result metrics
function getDynamicLabel(tag: LayoutTag, result: LayoutTestResult): string {
  const { canvasAspect, heroCoverage, heroToRunnerUpRatio, 
          cellAreaPercents, rowSizes, largestToSmallestRatio } = result;
  
  switch (tag) {
    case 'wrong-shape':
      return `Wrong shape (${canvasAspect.toFixed(2)})`;
    
    case 'extreme-aspect':
      return `Extreme aspect (${canvasAspect.toFixed(2)})`;
    
    case 'hero-not-prominent':
      if (heroCoverage !== null && cellAreaPercents.length >= 4) {
        const top3NonHero = cellAreaPercents.slice(1, 4)
          .map(p => `${(p * 100).toFixed(0)}%`).join('/');
        return `Hero not prominent (${(heroCoverage * 100).toFixed(0)}% vs ${top3NonHero})`;
      }
      return 'Hero not prominent';
    
    case 'hero-too-dominant':
      if (heroCoverage !== null && heroToRunnerUpRatio !== null) {
        return `Hero too dominant (${(heroCoverage * 100).toFixed(0)}% · ${heroToRunnerUpRatio.toFixed(1)}×)`;
      }
      return 'Hero too dominant';
    
    case 'row-too-dense':
      return `Row too dense ([${rowSizes.join(', ')}])`;
    
    case 'single-photo-row':
      return `Single-photo row ([${rowSizes.join(', ')}])`;
    
    case 'uneven-sizes':
      return `Uneven sizes (${largestToSmallestRatio.toFixed(1)}×)`;
    
    // Static labels for these
    case 'wasted-space':
      return 'Wasted space';
    case 'well-balanced':
      return 'Well balanced';
    case 'hero-works':
      return 'Hero works well';
    
    default:
      return tag;
  }
}
```

## Visual Result

The tag checkboxes will look like:

```text
ISSUES                              POSITIVES
☐ Hero not prominent (18% vs 15/12/11%)   ☐ Well balanced
☐ Hero too dominant (45% · 3.2×)          ☐ Hero works well
☐ Single-photo row ([1, 3, 2])
☐ Row too dense ([1, 5, 4])
☐ Uneven sizes (4.2×)
☐ Wrong shape (0.67)
☐ Extreme aspect (0.42)
☐ Wasted space
```

## Technical Notes

- Labels update instantly as you navigate between layouts
- Metrics display the same values as the MetricsBadges, just in context
- No changes to the underlying data model or storage

