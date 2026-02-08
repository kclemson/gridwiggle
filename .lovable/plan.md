
# Clickable Region-Reject Logs with Layout Popovers

## What You'll Get
When you hover over any `[region-reject]` log entry in the debug panel, a popover will appear showing the CSS visualization of the layout that was rejected. This lets you visually inspect all 7 intermediate rejection candidates, not just the last one.

## Design Approach

### Data Flow
The geometry is already calculated at rejection time. We need to:
1. Capture it with each log entry (instead of overwriting a single variable)
2. Render it in the log panel when the entry is hovered

### Visual Behavior
- Hover over any red `[region-reject]` row → mini layout appears in a popover
- Layout uses same CSS visualization as the main canvas (colored rectangles, labels)
- Popover sized appropriately (~200px wide, maintaining aspect ratio)
- Red ring around the popover to indicate "rejected"

---

## Technical Implementation

### Step 1: Extend LogEntry to carry geometry

**File: `src/lib/devLogger.ts`**

Add an optional `rejectedLayout` field to `LogEntry`:

```typescript
export interface LogEntry {
  timestamp: number;
  category: string;
  label: string;
  data: Record<string, unknown>;
  level?: 'info' | 'warn' | 'error';
  // NEW: optional geometry for rejected layouts
  rejectedLayout?: {
    cells: Array<{ photoId: string; x: number; y: number; width: number; height: number }>;
    canvasWidth: number;
    canvasHeight: number;
  };
}
```

Update `devLogger.log()` signature to accept the optional geometry.

### Step 2: Attach geometry at rejection time

**File: `src/lib/v3/region-search.ts`**

At each `[region-reject]` log call, pass the geometry as a fourth argument:

```typescript
devLogger.warn('region-reject', 'Prominence too low', {
  besideCount,
  besideRowCount,
  prominenceRatio: prominenceRatio.toFixed(2),
  required: effectiveMinProminence,
}, {
  cells: buildRejectedCells(...),
  canvasWidth: normalizedWidthWithBorder,
  canvasHeight: normalizedHeightWithBorder,
});
```

This captures the geometry inline with each rejection log.

### Step 3: Create a mini layout preview component

**File: `src/components/debug/RejectedLayoutPreview.tsx`** (new file)

A compact version of `LayoutVisualization` sized for popovers:

```typescript
interface RejectedLayoutPreviewProps {
  cells: Array<{ photoId: string; x: number; y: number; width: number; height: number }>;
  canvasWidth: number;
  canvasHeight: number;
}

export function RejectedLayoutPreview({ cells, canvasWidth, canvasHeight }: RejectedLayoutPreviewProps) {
  // Scale from normalized space to ~200px preview
  // Render colored rectangles with photo labels
  // Red ring around the container
}
```

### Step 4: Wrap rejection logs in HoverCard

**File: `src/components/debug/DebugLogPanel.tsx`**

For log entries with `rejectedLayout` attached:

```typescript
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { RejectedLayoutPreview } from './RejectedLayoutPreview';

// In the render loop:
{entry.rejectedLayout ? (
  <HoverCard openDelay={100}>
    <HoverCardTrigger asChild>
      <div className="cursor-pointer underline decoration-dotted ...">
        [{entry.category}] {entry.label}
      </div>
    </HoverCardTrigger>
    <HoverCardContent side="right" className="w-auto p-2">
      <RejectedLayoutPreview {...entry.rejectedLayout} />
    </HoverCardContent>
  </HoverCard>
) : (
  // Current non-interactive rendering
)}
```

---

## Files Modified

| File | Change |
|------|--------|
| `src/lib/devLogger.ts` | Add `rejectedLayout` to `LogEntry`, update `log()` signature |
| `src/lib/v3/region-search.ts` | Pass geometry to each `region-reject` log call (3 locations) |
| `src/components/debug/RejectedLayoutPreview.tsx` | New component - mini CSS visualization |
| `src/components/debug/DebugLogPanel.tsx` | Wrap rejection entries in `HoverCard` |
| `src/components/debug/index.ts` | Export new component |

---

## Edge Cases Handled

- **Logs without geometry**: Non-rejection logs render normally (no hover behavior)
- **No photos data**: Preview shows just colored cells without AR labels (since the log doesn't have the full photo data, just IDs)
- **Scroll behavior**: HoverCard positions itself appropriately within the ScrollArea

---

## Result

After implementation, you can shuffle in V3Test and hover over any of the 7 `[region-reject] Prominence too low` entries to see exactly what that particular candidate layout looked like — making it immediately clear whether the rejection was justified or overly strict.
