

# Debug Panel for Hero Layout Logs (Dev Mode Only)

## Overview

Add a floating debug panel positioned to the right of the centered 512px app container that displays the `[Hero]` console logs from collage generation. The panel will only be visible in development mode using Vite's `import.meta.env.DEV` flag.

## Implementation

### 1. Create Log Capture Utility

**File: `src/lib/debugLogger.ts`** (new file)

A utility that wraps function execution and captures `[Hero]` console logs:

```typescript
export interface HeroLogEntry {
  timestamp: number;
  label: string;
  data: Record<string, unknown>;
}

export function captureHeroLogs<T>(fn: () => T): { result: T; logs: HeroLogEntry[] } {
  // Only capture in dev mode
  if (!import.meta.env.DEV) {
    return { result: fn(), logs: [] };
  }
  
  const logs: HeroLogEntry[] = [];
  const originalLog = console.log;
  
  console.log = (...args) => {
    originalLog.apply(console, args);
    
    if (typeof args[0] === 'string' && args[0].startsWith('[Hero]')) {
      logs.push({
        timestamp: Date.now(),
        label: args[0].replace('[Hero] ', ''),
        data: args[1] || {},
      });
    }
  };
  
  try {
    const result = fn();
    return { result, logs };
  } finally {
    console.log = originalLog;
  }
}
```

### 2. Create DebugPanel Component

**File: `src/components/DebugPanel.tsx`** (new file)

A fixed-position panel that displays captured logs:

- **Positioning**: Fixed to right of the 512px container using `left: calc(50% + 256px + 24px)`
- **Visibility**: Only renders when `import.meta.env.DEV` is true
- **Responsive**: Hidden on screens narrower than 1280px (xl breakpoint)
- **Layout**: Scrollable, monospace text with visual indicators for log types

Visual design:
```text
┌─ Hero Layout Logs ────────────────┐
│ 2:34:15 PM                        │
├───────────────────────────────────┤
│ ▸ Strategy                        │
│   strategy: edge-anchored         │
│   standardCount: 5                │
│   heroAspect: 0.75                │
├───────────────────────────────────┤
│ ✓ Trying config (2-row)           │
│   besideCount: 4                  │
│   optimalFraction: 0.42           │
│   scaleFactor: 1.00               │
│   clamped: false                  │
├───────────────────────────────────┤
│ ✓ Layout complete                 │
│   finalAspect: 0.85               │
│   heroPctOfCanvas: 48.2%          │
└───────────────────────────────────┘
```

Log entry styling:
- **Strategy/Config logs**: Blue arrow indicator
- **Accepted configs**: Green checkmark
- **Rejected configs**: Red X
- **Fallbacks**: Orange warning icon
- **Layout complete**: Green checkmark

### 3. Integrate into Index.tsx

**File: `src/pages/Index.tsx`** (modify)

Add state for debug logs and wrap layout generation:

```typescript
// New state (only used in dev)
const [debugLogs, setDebugLogs] = useState<HeroLogEntry[]>([]);

// In regenerateCollage, wrap the layout generation:
const { result: layout, logs } = captureHeroLogs(() => 
  generateCollageLayout(photosToUse, settings, { 
    photoWeights,
    randomize,
  })
);
setDebugLogs(logs);
setLayout(layout);

// Render DebugPanel outside the 512px container:
{import.meta.env.DEV && (
  <DebugPanel logs={debugLogs} />
)}
```

## Dev Mode Detection

Vite provides `import.meta.env.DEV` which is:
- `true` during `vite dev` (development server)
- `false` during `vite build` (production build)

This ensures:
- Zero bundle size impact in production (tree-shaken)
- No console.log patching in production
- Panel never renders for end users

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/debugLogger.ts` | Create - log capture utility |
| `src/components/DebugPanel.tsx` | Create - visual log display |
| `src/pages/Index.tsx` | Modify - integrate capture and panel |

## Technical Details

### Panel Positioning CSS

```css
.debug-panel {
  position: fixed;
  top: 64px; /* below sticky header */
  left: calc(50% + 256px + 24px); /* 256px = half of 512px container, 24px gap */
  width: 400px;
  max-height: calc(100vh - 80px);
  overflow-y: auto;
}
```

### Log Data Formatting

The component will format nested objects nicely:
- Numbers: fixed to 2 decimal places where appropriate
- Booleans: displayed as `true`/`false` with color coding
- Nested objects: indented and expandable

