

## Fix DebugPanel: Pending Count Not Updating on New Captures

### Design Intent
When new captures are saved via `saveCapture()`, the DebugPanel's `pendingCount` state doesn't update because it's only initialized once. We need to refresh it when the component re-renders due to new logs/duration.

### User Outcome
- "X pending" badge updates after each new layout generation
- Reset/Export buttons become enabled when captures exist
- Buttons correctly disable to 0 after reset/export

---

## Root Cause

The `useState` initializer only runs once. When `saveCapture()` is called in Index.tsx, DebugPanel doesn't re-read the count:

```typescript
// This only runs ONCE on mount
const [pendingCount, setPendingCount] = useState(() => getCaptureStats().pending);
```

---

## Solution

**Hybrid approach**: Keep state for reset/export actions, but sync from localStorage when `logs` prop changes (which happens after every generation).

| File | Changes |
|------|---------|
| `src/components/DebugPanel.tsx` | Add `useEffect` to sync pendingCount when logs change |

---

## Technical Details

Add a sync effect that runs when `logs` changes (after each generation):

```typescript
import { useState, useCallback, useEffect } from 'react';

export function DebugPanel({ 
  logs, 
  durationMs,
}: DebugPanelProps) {
  const [pendingCount, setPendingCount] = useState(() => getCaptureStats().pending);

  // Sync pending count when logs change (after each generation)
  useEffect(() => {
    setPendingCount(getCaptureStats().pending);
  }, [logs]);

  // ... rest unchanged
}
```

This is an appropriate use of `useEffect` because:
- We're syncing React state with an external system (localStorage)
- The `logs` prop change is the trigger that tells us a new capture was saved
- This is not state-to-state sync (which should be avoided), it's external-to-state sync

---

## Behavior After Fix

| Action | Result |
|--------|--------|
| Generate layout | Logs update → effect runs → badge shows new count |
| Click Reset | State set to 0 → badge disappears |
| Click Export | State set to 0 → badge disappears |

