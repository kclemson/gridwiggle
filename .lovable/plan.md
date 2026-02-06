

# Layout Reorganization: Debug Logs to the Left

## Current Layout
The page is currently a single column with stats, canvas, then debug logs stacked vertically. The logs section has a fixed `max-h-64` which limits visibility.

## Proposed Layout
Convert to a **side-by-side layout** with debug logs on the left and the collage canvas on the right.

```text
+------------------------------------------------------------------+
| V3 Layout Test                                     [Shuffle]     |
+------------------------------------------------------------------+
| 38 photos  ★ Hero AR: 1.40  Avg AR: 0.86                         |
+---------------------------+--------------------------------------+
|                           |                                      |
| Debug Logs (46)           |   [ Collage Canvas ]                 |
| ─────────────────         |                                      |
| [v3] Starting V3...       |                                      |
| [v3] Photo analysis...    |                                      |
| [v3-split] BESIDE...      |                                      |
| [v3-split] BESIDE...      |                                      |
| ...                       |                                      |
| (scrollable, tall)        |   Canvas: 480×955px                  |
|                           |                                      |
+---------------------------+--------------------------------------+
```

## Changes

### File: `src/pages/V3Test.tsx`

1. **Widen container**: Change from `max-w-2xl` to `max-w-6xl` to accommodate side-by-side layout

2. **Create two-column grid**: Use CSS grid with the logs panel on the left (fixed width ~400px) and canvas on the right (flexible)

3. **Remove collapsible**: The logs will be always visible in the left panel with vertical scrolling

4. **Logs panel styling**: 
   - Remove `max-h-64` constraint
   - Use `h-full` with `overflow-y-auto` to fill available height
   - Sticky header with "Debug Logs (count)"

5. **Responsive consideration**: On smaller screens, stack vertically (logs below canvas)

### Layout Structure

```tsx
<div className="min-h-screen bg-background p-6">
  {/* Header + Stats (full width) */}
  
  {/* Two-column layout */}
  <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
    {/* Left: Debug Logs */}
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="p-3 border-b font-medium">Debug Logs ({logs.length})</div>
      <div className="h-[70vh] overflow-y-auto p-3 font-mono text-xs">
        {/* Log entries */}
      </div>
    </div>
    
    {/* Right: Canvas */}
    <div className="border rounded-lg p-4 bg-card">
      <LayoutVisualization ... />
    </div>
  </div>
</div>
```

This gives the logs a tall scrollable area (~70vh) that's always visible alongside the canvas.

