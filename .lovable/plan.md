
# Add Success Rate to Pending Captures Badge

## Design Intent

Provide an at-a-glance view of algorithm success rate directly in the debug UI. When you see "47 pending (78%)", you immediately know how well the algorithm is performing without needing to export and analyze.

## User Outcome

- Both V3Test page and main app DebugPanel show success rate alongside pending count
- Badge displays as: "47 pending (78%)" with color coding (green > 80%, amber 50-80%, red < 50%)
- Single source of truth - logic lives in the shared capture storage module

---

## Technical Approach

### Current State

Two separate UIs manage pending capture display:

1. **V3Test** (line 215-219): Renders its own badge in the header + separate export/reset buttons
2. **DebugPanel** (line 52-80): Renders badge + buttons as `headerRight` passed to `DebugLogPanel`

Both call `getCaptureStats()` which only returns `{ total, pending }`.

### Solution

Consolidate the "pending badge + controls" into a reusable component that:
1. Extends `getCaptureStats()` to also return `successCount` for pending captures
2. Creates a `CaptureControls` component with the badge showing count + percentage
3. Uses `CaptureControls` in both locations

---

## File Changes

### 1. `src/lib/v3CaptureStorage.ts`

Extend `getCaptureStats()` to include success rate for pending captures:

```typescript
export function getCaptureStats(): { 
  total: number; 
  pending: number; 
  pendingSuccessCount: number;
} {
  const store = loadCaptures();
  const pendingCaptures = store.captures.filter(c => !c.exported);
  const pendingSuccessCount = pendingCaptures.filter(c => c.success).length;
  return { 
    total: store.captures.length, 
    pending: pendingCaptures.length,
    pendingSuccessCount,
  };
}
```

### 2. `src/components/debug/CaptureControls.tsx` (new file)

Create a shared component for the pending badge + export/reset controls:

```typescript
/**
 * Capture Controls Component
 * 
 * Displays pending capture count with success rate, plus export/reset buttons.
 * Used by both V3Test header and DebugPanel.
 */

interface CaptureControlsProps {
  pendingCount: number;
  successCount: number;
  onExport: () => void;
  onReset: () => void;
  variant?: 'compact' | 'full'; // compact for DebugPanel header, full for V3Test
}

export function CaptureControls({ ... }) {
  const successRate = pendingCount > 0 
    ? Math.round((successCount / pendingCount) * 100) 
    : 0;
  
  // Color: green > 80%, amber 50-80%, red < 50%
  const rateColor = successRate >= 80 
    ? 'text-green-600' 
    : successRate >= 50 
      ? 'text-amber-600' 
      : 'text-red-600';
  
  return (
    <div className="flex items-center gap-2">
      {pendingCount > 0 && (
        <Badge variant="secondary" className="tabular-nums text-xs">
          {pendingCount} pending 
          <span className={cn("ml-1", rateColor)}>({successRate}%)</span>
        </Badge>
      )}
      {/* Export/Reset buttons */}
    </div>
  );
}
```

### 3. `src/components/DebugPanel.tsx`

Update to use the new shared component:

- Import `CaptureControls` and `getCaptureStats`
- Track both `pendingCount` and `successCount` in state
- Pass `CaptureControls` as `headerRight` to `DebugLogPanel`

### 4. `src/pages/V3Test.tsx`

Update to use the new shared component:

- Replace the inline badge + buttons in header with `CaptureControls`
- Update state to track both pending and success counts
- Use `variant="full"` for slightly larger buttons in the header

---

## Visual Result

**Before:**
```
47 pending  [Reset] [Export]
```

**After:**
```
47 pending (78%)  [Reset] [Export]
```

With color coding:
- 78%+ = green (healthy)
- 50-78% = amber (concerning)  
- <50% = red (needs investigation)

---

## Component Hierarchy

```text
V3Test (header)
└── CaptureControls (variant="full")
    └── Badge with count + success rate
    └── Reset/Export buttons

DebugPanel
└── DebugLogPanel
    └── headerRight: CaptureControls (variant="compact")
        └── Badge with count + success rate  
        └── Smaller Reset/Export buttons
```
