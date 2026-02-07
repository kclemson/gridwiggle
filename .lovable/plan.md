
# Add Rejected Layout Visualization with Real Photos

## The Goal

When layout generation fails in the main app, show the rejected layout using actual uploaded photos (not just CSS mockups). This enables subjective evaluation of why a layout was rejected and helps identify algorithm issues.

## Current Flow

```text
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Index.tsx      │     │  Worker Thread   │     │   intersection   │
│                  │     │                  │     │                  │
│ regenerate() ────┼────►│ generateLayout() ├────►│ setRejected..()  │
│                  │     │                  │     │ (module scope)   │
│ receives result  │◄────┤ postMessage()    │     │                  │
│ (no rejected     │     │ (no rejected     │     │ getLastRejected  │
│  layout data)    │     │  layout data)    │     │ Layout() exists  │
└──────────────────┘     └──────────────────┘     └──────────────────┘
```

**Problem**: The rejected layout data is stored in module scope on the worker thread, but never sent back to the main thread.

## The Fix

### Step 1: Worker Returns Rejected Layout Data

Update `LayoutResponse` interface and worker logic to capture and return rejected layout geometry.

**File:** `src/workers/layoutWorker.ts`

```typescript
export interface LayoutResponse {
  // ... existing fields
  rejectedLayout?: {
    cells: { photoId: string; x: number; y: number; width: number; height: number }[];
    canvasWidth: number;
    canvasHeight: number;
    reason: string;
    details: Record<string, unknown>;
  };
}
```

In the message handler, after `generateLayout()`:
```typescript
if (!layout) {
  const rejected = getLastRejectedLayout();
  if (rejected?.cells) {
    response.rejectedLayout = {
      cells: rejected.cells,
      canvasWidth: rejected.canvasWidth!,
      canvasHeight: rejected.canvasHeight!,
      reason: rejected.reason,
      details: rejected.details,
    };
  }
}
```

### Step 2: Service Returns Rejected Layout

**File:** `src/services/layoutGenerationService.ts`

Update `LayoutGenerationResult` to include rejected layout:

```typescript
export interface LayoutGenerationResult {
  // ... existing fields
  rejectedLayout?: {
    cells: { photoId: string; x: number; y: number; width: number; height: number }[];
    canvasWidth: number;
    canvasHeight: number;
    reason: string;
    details: Record<string, unknown>;
  };
}
```

Pass through from worker response.

### Step 3: Main App Stores and Displays Rejected Layout

**File:** `src/pages/Index.tsx`

1. Add state for rejected layout:
```typescript
const [rejectedLayout, setRejectedLayout] = useState<{
  cells: CollageCell[];
  canvasWidth: number;
  canvasHeight: number;
  reason: string;
  details: Record<string, unknown>;
} | null>(null);
```

2. In `regenerateCollage`, capture rejected layout from result:
```typescript
if (layout) {
  setLayout(layout);
  setRejectedLayout(null); // Clear on success
} else {
  // Capture rejected layout if available
  if (result.rejectedLayout) {
    // Scale from normalized to pixels (1000 base)
    const scaled = {
      cells: result.rejectedLayout.cells.map(c => ({
        photoId: c.photoId,
        x: Math.round(c.x * 1000),
        y: Math.round(c.y * 1000),
        width: Math.round(c.width * 1000),
        height: Math.round(c.height * 1000),
      })),
      canvasWidth: Math.round(result.rejectedLayout.canvasWidth * 1000),
      canvasHeight: Math.round(result.rejectedLayout.canvasHeight * 1000),
      reason: result.rejectedLayout.reason,
      details: result.rejectedLayout.details,
    };
    setRejectedLayout(scaled);
  }
  setLayoutError("Couldn't generate...");
}
```

3. In the error overlay (around line 719), show the rejected layout with real photos:
```tsx
{layoutError && rejectedLayout && (
  <div className="relative">
    {/* Show rejected layout with real photos */}
    <div className="ring-4 ring-destructive rounded-lg overflow-hidden opacity-60">
      <CollagePreview
        photos={state.photos}
        layout={{
          width: rejectedLayout.canvasWidth,
          height: rejectedLayout.canvasHeight,
          cells: rejectedLayout.cells,
        }}
        gapColor={state.settings.gapColor}
        onSwapPhotos={() => {}} // Disabled for rejected
        // No interactions on rejected layout
      />
    </div>
    {/* Rejection badge */}
    <RejectionBadge 
      reason={rejectedLayout.reason} 
      details={rejectedLayout.details} 
    />
  </div>
)}
```

## Summary of Changes

| File | Change |
|------|--------|
| `src/workers/layoutWorker.ts` | Add `rejectedLayout` to response, capture from `getLastRejectedLayout()` |
| `src/services/layoutGenerationService.ts` | Add `rejectedLayout` to result type, pass through from worker |
| `src/pages/Index.tsx` | Add state for rejected layout, scale and store on failure, render with `CollagePreview` and `RejectionBadge` |

## What This Enables

- See rejected layouts with **actual uploaded photos** (not CSS mockups)
- Compare visual output with debug log metrics
- Identify cases where synthetic test photos don't match real-world inputs
- Subjective evaluation: "This looks fine, why was it rejected?"
