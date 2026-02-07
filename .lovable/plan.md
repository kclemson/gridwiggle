

## Add Export & Reset Controls to Main App Debug Panel

### Design Intent
Enable JSON export of layout captures from the main app using direct event handler calls instead of effects - cleaner, more predictable, no state sync.

### User Outcome
- "X pending" badge shows captures ready to export
- Export button downloads JSON, Reset button clears captures
- No automatic clearing - full manual control

---

## Architecture: Event Handler vs Effect

```text
Effect Approach (avoided):              Event Handler Approach (preferred):
┌─────────────────────────┐             ┌─────────────────────────┐
│ Index.tsx               │             │ Index.tsx               │
│   setState(captureData) │             │   saveCapture() ◄────── Direct call
└───────────┬─────────────┘             └─────────────────────────┘
            │                           
            ▼                           
┌─────────────────────────┐             
│ DebugPanel.tsx          │             No prop passing, no effect,
│   useEffect(() => {     │             just call the function when
│     saveCapture(...)    │             generation completes
│   }, [captureData])     │             
└─────────────────────────┘             
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/DebugPanel.tsx` | Add export/reset UI only (no captureData prop, no effect) |
| `src/pages/Index.tsx` | Call `saveCapture()` directly after generation completes |

---

## Technical Details

### 1. DebugPanel.tsx - Simple Export UI

No `captureData` prop, no save effect. Just UI controls:

```typescript
import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2 } from 'lucide-react';
import { 
  getCaptureStats, 
  exportPendingCaptures, 
  downloadJson,
  clearCaptures,
} from '@/lib/v3CaptureStorage';

export function DebugPanel({ 
  logs, 
  durationMs,
  algorithmVersion,
  onAlgorithmVersionChange,
}: DebugPanelProps) {
  const [pendingCount, setPendingCount] = useState(() => getCaptureStats().pending);

  // Refresh count (called after external save)
  const refreshPendingCount = useCallback(() => {
    setPendingCount(getCaptureStats().pending);
  }, []);

  const handleExport = useCallback(() => {
    const { data, count } = exportPendingCaptures();
    if (count === 0) return;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    downloadJson(data, `v3-captures-${algorithmVersion}-${timestamp}.json`);
    setPendingCount(0);
  }, [algorithmVersion]);

  const handleReset = useCallback(() => {
    clearCaptures();
    setPendingCount(0);
  }, []);

  // ... rest of component with headerRight containing controls
}
```

### 2. Index.tsx - Direct saveCapture Call

Call `saveCapture()` directly in the generation callback:

```typescript
import { 
  saveCapture, 
  extractReasonFrequencies,
  getLastRejection,
} from '@/lib/v3CaptureStorage';

// In regenerateCollage, after worker responds:
const regenerateCollage = useCallback(async (...) => {
  // ... existing generation logic ...
  
  worker.onmessage = (e) => {
    const result = e.data;
    
    // ... existing result handling ...
    
    // Save capture directly (dev only, v3 only)
    if (isDev && algorithmVersion === 'v3') {
      const heroPhoto = photosToUse.find(p => /* priority 1 */);
      const avgAR = dimensions.reduce((s, d) => s + d.aspectRatio, 0) / dimensions.length;
      const landscapeCount = dimensions.filter(d => d.aspectRatio > 1).length;
      const orientationBias = dimensions.length > 0 
        ? (landscapeCount / dimensions.length) * 2 - 1 
        : 0;
      
      const { rejectReasons, feasibilityReasons, rejectCount, feasibilityCount } = 
        extractReasonFrequencies(result.logs || []);
      const lastRejection = getLastRejection(result.logs || []);
      
      saveCapture({
        photoCount: photosToUse.length,
        heroCount: heroPhoto ? 1 : 0,
        heroAR: heroPhoto 
          ? dimensions.find(d => d.id === heroPhoto.id)?.aspectRatio ?? null 
          : null,
        avgAR,
        orientationBias,
        seed: requestId,
        success: result.layout !== null,
        canvasWidth: result.layout?.width ?? null,
        canvasHeight: result.layout?.height ?? null,
        canvasAR: result.layout 
          ? result.layout.width / result.layout.height 
          : null,
        cellCount: result.layout?.cells.length ?? null,
        logCount: result.logs?.length ?? 0,
        rejectCount,
        rejectReasons,
        feasibilityCount,
        feasibilityReasons,
        durationMs: result.durationMs ?? 0,
        failureReason: result.layout ? null : lastRejection?.reason ?? 'unknown',
        failureDetails: result.layout ? null : lastRejection?.details ?? null,
        capturedAt: new Date().toISOString(),
      });
    }
  };
}, [algorithmVersion, /* other deps */]);
```

### 3. Refresh Pending Count

DebugPanel needs to know when captures change. Two options:

**Option A**: Pass a ref to DebugPanel's refresh function:
```typescript
// Index.tsx
const debugPanelRef = useRef<{ refreshPendingCount: () => void }>(null);

// After saveCapture:
debugPanelRef.current?.refreshPendingCount();

// DebugPanel
forwardRef + useImperativeHandle
```

**Option B**: Simpler - just re-read on any render (cheap localStorage read):
```typescript
// DebugPanel re-reads count on each render
// Badge shows current value, updates naturally when component re-renders
```

I'll use Option B since it's simpler and localStorage reads are fast.

---

## UI Layout

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Debug Logs          15 logs  2.1ms  [3 pending] [🗑] [⬇] │v1│v3│          │
├────────────────────────────────────────────────────────────────────────────┤
│ [region] Starting search photoCount:8, heroAR:0.67                         │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Behaviors

| Action | Result |
|--------|--------|
| Generate layout (v3) | Saves capture directly in callback |
| Generate layout (v1) | No capture saved |
| Click Reset | Clears all captures |
| Click Export | Downloads JSON with algorithm version in filename |

