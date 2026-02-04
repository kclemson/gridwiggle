

# Two-Column Layout for Debug Panel

## Overview

Restructure the debug panel to display log entries in two columns side-by-side, making the panel shorter and better suited for screenshots that capture both the collage and its associated logs.

## Current Layout

```text
┌─ HERO LAYOUT LOGS ─────────────────┐
│ ▸ Strategy                         │
│   strategy: floating               │
│   standardCount: 19                │
│ ▸ Floating config                  │
│   useIntroRows: false              │
│   ...                              │
│ ▸ Side packing                     │
│   ...                              │
│ ✗ Trying config                    │
│   ...                              │
│ ⚠ Fallback triggered               │
│   ...                              │
│ ▸ Edge-anchored config             │
│   ...                              │
│ ✓ Trying config                    │
│   ...                              │
│ ✓ Layout complete                  │
│   ...                              │
└────────────────────────────────────┘
       360px × ~900px tall
```

## Proposed Layout

Split the log entries across two columns:

```text
┌─ HERO LAYOUT LOGS ─────────────────────────────────────────────────────────┐
│ ▸ Strategy              │ ⚠ Fallback triggered                            │
│   strategy: floating    │   reason: scale-out-of-tolerance                │
│   standardCount: 19     │   scaleFactor: 0.74                             │
│ ▸ Floating config       │ ▸ Edge-anchored config                          │
│   useIntroRows: false   │   useIntroRows: true                            │
│   introPhotoCount: 0    │   introPhotoCount: 6                            │
│   leftCount: 6          │   remainingPhotos: 13                           │
│   rightCount: 6         │   anchorSide: left                              │
│   belowCount: 7         │ ✓ Trying config                                 │
│ ▸ Side packing          │   rowMode: 3-row                                │
│   leftRows: 3           │   besideCount: 12                               │
│   leftHeight: 534       │   optimalFraction: 0.47                         │
│   ...                   │   ...                                           │
│ ✗ Trying config         │ ✓ Layout complete                               │
│   rowMode: floating     │   finalAspect: 0.56                             │
│   ...                   │   ...                                           │
└─────────────────────────┴───────────────────────────────────────────────────┘
                       ~700px wide × ~450px tall
```

## Implementation

### File: `src/components/DebugPanel.tsx`

Change the log entries container from a single column to a CSS grid with two columns:

```typescript
// Replace the single-column log list with a two-column grid
<div className="grid grid-cols-2 divide-x divide-border/50">
  {/* Left column */}
  <div>
    {logs.slice(0, midpoint).map(...)}
  </div>
  {/* Right column */}
  <div>
    {logs.slice(midpoint).map(...)}
  </div>
</div>
```

Key changes:
- Calculate `midpoint = Math.ceil(logs.length / 2)` to split logs evenly
- Use `grid grid-cols-2` for the two-column layout
- Add `divide-x divide-border/50` for a subtle vertical separator
- Reduce individual entry padding slightly to keep things compact

### File: `src/pages/Index.tsx`

Increase the debug panel width to accommodate two columns:

```typescript
// Change width from 360px to 700px
style={{ left: 'calc(100% + 24px)', width: '700px' }}
```

## Files Modified

| File | Changes |
|------|---------|
| `src/components/DebugPanel.tsx` | Split log entries into two-column grid layout |
| `src/pages/Index.tsx` | Increase debug panel width from 360px to 700px |

