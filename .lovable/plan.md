
# Add Rejected Layout Cells to JSON Export

## Design Intent

Extend the existing capture system to include the actual cell coordinates of rejected layouts. This enables:
1. **Visual reconstruction** - Display rejected layouts in V3Test with a toggle
2. **Batch analysis** - Export rejected layout geometry for pattern detection across many failures
3. **Threshold calibration** - See exactly what "hero_too_large_vs_smallest_cells" looks like at ratio 28× vs 22×

## User Outcomes

- "Show Rejected" toggle in V3Test displays failed layouts with a red border
- Rejection badge shows the failure reason and key metrics
- Exported JSON now includes cell geometry for failed layouts, enabling offline analysis
- Works for ANY rejection type (canvas_too_tall, prominence_too_low, hero_too_large, etc.)

---

## Technical Approach

### The Key Insight

Currently, when validation fails in `evaluateNormalizedProposal`, we call `setRejection()` with reason/details but discard the layout. However, at the point of failure (lines 256-275 in intersection.ts), we already have:
- `besideResult.cells` and `belowResult.cells` (packed content)
- `heroArea`, `normalizedWidth`, `normalizedHeight` (canvas geometry)
- All data needed to call `convertToNormalized()` and build valid cells

**Solution**: Before returning `null`, compute cells and store them alongside the rejection metadata.

---

## File Changes

### 1. `src/lib/v3/types.ts`

Add a new type for rejected layout data:

```typescript
/**
 * A layout that was rejected during validation.
 * Stores cell geometry so rejected layouts can be visualized for debugging.
 */
export interface RejectedLayout {
  /** Cell coordinates (null if rejection happened before packing) */
  cells: LayoutCell[] | null;
  /** Canvas width in normalized space */
  canvasWidth: number | null;
  /** Canvas height in normalized space */
  canvasHeight: number | null;
  /** Rejection reason identifier */
  reason: string;
  /** Detailed metrics that triggered rejection */
  details: Record<string, unknown>;
  /** Timestamp for correlation with logs */
  timestamp: number;
}
```

### 2. `src/lib/v3/intersection.ts`

Add rejected layout storage alongside existing rejection tracking:

```typescript
// After line 31 (existing lastRejection)
let lastRejectedLayout: RejectedLayout | null = null;

export function setRejectedLayout(layout: RejectedLayout) {
  lastRejectedLayout = layout;
}

export function getLastRejectedLayout(): RejectedLayout | null {
  return lastRejectedLayout;
}

export function clearRejectedLayout() {
  lastRejectedLayout = null;
}
```

Modify each rejection point in `evaluateNormalizedProposal` to compute and store cells before returning null:

**At canvas AR rejection (lines 229-245)**:
```typescript
if (canvasAR < tuning.canvas_minAR - AR_EPSILON) {
  // Compute cells for visualization even though layout is rejected
  const cells = convertToNormalized(...);
  setRejectedLayout({
    cells,
    canvasWidth, canvasHeight,
    reason: 'canvas_too_tall',
    details: { canvasAR: +canvasAR.toFixed(2), minAR: tuning.canvas_minAR },
    timestamp: Date.now(),
  });
  // ... existing logging and return null
}
```

Same pattern for `canvas_too_wide`, `prominence_too_low`, and `hero_too_large_vs_smallest_cells`.

### 3. `src/lib/v3CaptureStorage.ts`

Extend `V3LayoutCapture` to include rejected layout cells:

```typescript
export interface V3LayoutCapture {
  // ... existing fields ...
  
  // NEW: Rejected layout geometry (for visualization)
  rejectedCells: Array<{
    photoId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }> | null;
  rejectedCanvasWidth: number | null;
  rejectedCanvasHeight: number | null;
}
```

### 4. `src/pages/V3Test.tsx`

Update `buildCapture()` to include rejected layout data:

```typescript
import { getLastRejectedLayout } from '@/lib/v3/intersection';

function buildCapture(...): Omit<V3LayoutCapture, 'exported'> {
  const rejectedLayout = getLastRejectedLayout();
  
  return {
    // ... existing fields ...
    
    // Rejected layout geometry
    rejectedCells: rejectedLayout?.cells ?? null,
    rejectedCanvasWidth: rejectedLayout?.canvasWidth ?? null,
    rejectedCanvasHeight: rejectedLayout?.canvasHeight ?? null,
  };
}
```

Add toggle state and display logic:

```typescript
const [showRejected, setShowRejected] = useState(false);

// In header - new toggle button
<Button 
  onClick={() => setShowRejected(s => !s)}
  variant={showRejected ? "default" : "outline"}
  size="sm"
>
  {showRejected ? "Showing Rejected" : "Show Rejected"}
</Button>

// In canvas area - show rejected layout when toggle is on
{layout ? (
  <LayoutVisualization layout={layout} photos={photoSet.photos} />
) : showRejected && rejectedLayout?.cells ? (
  <div className="ring-2 ring-red-500 rounded-lg overflow-hidden">
    <LayoutVisualization 
      layout={scaleRejectedLayout(rejectedLayout)} 
      photos={photoSet.photos} 
    />
    <RejectionBadge reason={rejectedLayout.reason} details={rejectedLayout.details} />
  </div>
) : (
  <div>Layout generation failed</div>
)}
```

### 5. New Component: `src/components/debug/RejectionBadge.tsx`

Display rejection reason with expandable metrics:

```typescript
interface RejectionBadgeProps {
  reason: string;
  details: Record<string, unknown>;
}

export function RejectionBadge({ reason, details }: RejectionBadgeProps) {
  return (
    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center gap-2 text-red-700 font-medium">
        <AlertTriangle className="h-4 w-4" />
        Rejected: {reason.replace(/_/g, ' ')}
      </div>
      <div className="mt-1 text-sm text-red-600 font-mono">
        {Object.entries(details).map(([k, v]) => (
          <div key={k}>{k}: {JSON.stringify(v)}</div>
        ))}
      </div>
    </div>
  );
}
```

### 6. `src/components/debug/index.ts`

Export the new component.

---

## JSON Export Format

After implementation, the exported JSON for a failed layout will include:

```json
{
  "photoCount": 32,
  "heroCount": 1,
  "heroAR": 1.45,
  "success": false,
  "failureReason": "hero_too_large_vs_smallest_cells",
  "failureDetails": {
    "ratio": 28.3,
    "maxAllowed": 22
  },
  "rejectedCells": [
    { "photoId": "hero", "x": 0.02, "y": 0.02, "width": 1.45, "height": 1.0 },
    { "photoId": "p1", "x": 1.49, "y": 0.02, "width": 0.35, "height": 0.48 },
    ...
  ],
  "rejectedCanvasWidth": 2.12,
  "rejectedCanvasHeight": 1.85
}
```

This enables batch analysis: filter failures by reason, visualize cell distributions, identify patterns.

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Add `RejectedLayout` type |
| `src/lib/v3/intersection.ts` | Add rejected layout capture at each validation point |
| `src/lib/v3CaptureStorage.ts` | Extend `V3LayoutCapture` with rejected cell fields |
| `src/pages/V3Test.tsx` | Add toggle + rejected layout display + capture integration |
| `src/components/debug/RejectionBadge.tsx` | New component for rejection metadata display |
| `src/components/debug/index.ts` | Export new component |
