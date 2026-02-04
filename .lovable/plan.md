

# Reposition Debug Panel Next to Collage Section

## Overview

Move the debug panel from its current fixed position at the top of the page to align vertically with the collage preview section. This allows capturing both the collage and its associated layout logs in a single screenshot.

## Current Behavior

The debug panel uses `fixed top-16` positioning, which places it at the top of the viewport regardless of scroll position. As shown in your screenshot, this means the logs appear next to the photo grid rather than next to the collage output.

## Proposed Solution

Instead of a fixed-position panel at the document level, we'll render the debug panel **inline with the collage section** using a relative positioning approach:

1. Create a wrapper around the collage preview section
2. Position the debug panel absolutely relative to that wrapper
3. This keeps the panel anchored to the collage visually while allowing the rest of the UI to scroll normally

## Implementation

### File: `src/components/DebugPanel.tsx`

Remove the fixed positioning and change to a simpler relative design:

```text
Before:
  className="fixed top-16 hidden xl:block z-50"
  style={{ left: 'calc(50% + 256px + 24px)', ... }}

After:
  className="hidden xl:block"
  (no inline positioning styles - will be positioned by parent)
```

The component will just render the panel UI without positioning itself.

### File: `src/pages/Index.tsx`

Wrap the collage section in a relative container and position the debug panel:

```text
Before (lines 357-426):
  <div className="space-y-2 pt-4 border-t border-border">
    {/* collage content */}
  </div>

  {/* Debug panel rendered separately at end of component */}

After:
  <div className="relative">
    <div className="space-y-2 pt-4 border-t border-border">
      {/* collage content */}
    </div>
    
    {/* Debug panel positioned to the right of this section */}
    {import.meta.env.DEV && (
      <div 
        className="absolute top-0 hidden xl:block"
        style={{ left: 'calc(100% + 24px)', width: '360px' }}
      >
        <DebugPanel logs={debugLogs} />
      </div>
    )}
  </div>
```

This positions the panel:
- `top-0`: Aligned with the top of the collage section
- `left: calc(100% + 24px)`: 24px to the right of the 512px container

## Visual Result

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              viewport                                        │
│                                                                              │
│              ┌──────────────────┐                                            │
│              │  Photos grid     │                                            │
│              │  (no panel here) │                                            │
│              └──────────────────┘                                            │
│                                                                              │
│              ┌──────────────────┐     ┌─────────────────────┐                │
│              │  COLLAGE         │     │ HERO LAYOUT LOGS    │                │
│              │  header row      │     │                     │                │
│              ├──────────────────┤     │ ▸ Strategy          │                │
│              │                  │     │   strategy: floating│                │
│              │  Collage         │     │   standardCount: 19 │                │
│              │  Preview         │     │                     │                │
│              │                  │     │ ✓ Layout complete   │                │
│              └──────────────────┘     └─────────────────────┘                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Files Modified

| File | Changes |
|------|---------|
| `src/components/DebugPanel.tsx` | Remove fixed positioning, simplify to just the panel UI |
| `src/pages/Index.tsx` | Move debug panel rendering into the collage section with relative positioning |

