

## Auto-Capture V3 Layout Metadata (Event Handler Approach)

### Design Intent
Passively capture structured metadata about every layout generation during V3 testing, with captures triggered directly in event handlers rather than via useEffect. This follows the principle of "event handlers for persistence" and avoids unnecessary effect synchronization.

### User Outcome
Every shuffle on `/v3-test` automatically logs inputs, outputs, and reason frequency maps to localStorage. A counter shows pending captures, and Export downloads all since last export.

---

## Architecture

### Key Refactor: No useEffect

Instead of:
```typescript
// ❌ Side effect watching state
useEffect(() => {
  if (logs && layout) saveCapture(...);
}, [logs, layout]);
```

We do:
```typescript
// ✅ Direct persistence in event handler
const handleShuffle = () => {
  const newSet = generateRandomSet();
  const result = generateLayoutResult(newSet);
  setResult(result);
  saveCapture(buildCapture(newSet, result));
};
```

Layout generation becomes a pure function that returns all needed data (layout, logs, duration), and the event handler orchestrates both state updates and persistence.

---

## Data Structure

```typescript
interface V3LayoutCapture {
  // Inputs
  photoCount: number;
  heroCount: number;
  heroAR: number | null;
  avgAR: number;
  orientationBias: number;
  seed: number;
  
  // Outputs
  success: boolean;
  canvasWidth: number | null;
  canvasHeight: number | null;
  canvasAR: number | null;
  cellCount: number | null;
  
  // Log metrics with reason breakdowns
  logCount: number;
  rejectCount: number;
  rejectReasons: Record<string, number>;
  feasibilityCount: number;
  feasibilityReasons: Record<string, number>;
  durationMs: number;
  
  // Failure info
  failureReason: string | null;
  failureDetails: Record<string, unknown> | null;
  
  // Metadata
  capturedAt: string;
  exported: boolean;
}
```

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `src/lib/v3CaptureStorage.ts` | **New:** Type definition, localStorage helpers (save, export, stats) |
| `src/pages/V3Test.tsx` | Refactor to event-handler pattern, add capture on shuffle, add Export button |

---

## Technical Details

### New File: `src/lib/v3CaptureStorage.ts`

```typescript
export interface V3LayoutCapture {
  // ... full interface as above
}

const STORAGE_KEY = 'v3-layout-captures';

interface V3CaptureStore {
  captures: V3LayoutCapture[];
  lastExportedAt: string | null;
}

// Load from localStorage
export function loadCaptures(): V3CaptureStore

// Save a new capture (sets exported: false)
export function saveCapture(capture: Omit<V3LayoutCapture, 'exported'>): void

// Export pending, mark as exported, return data + filename
export function exportPendingCaptures(): { data: V3LayoutCapture[]; count: number }

// Get stats for UI badge
export function getCaptureStats(): { total: number; pending: number }

// Helper: extract reason frequencies from logs
export function extractReasonFrequencies(logs: LogEntry[]): {
  rejectReasons: Record<string, number>;
  feasibilityReasons: Record<string, number>;
  rejectCount: number;
  feasibilityCount: number;
}
```

### V3Test.tsx Refactoring

**1. Extract pure layout generation function:**

```typescript
interface LayoutResult {
  layout: CollageLayout | null;
  logs: LogEntry[];
  durationMs: number;
}

function generateLayoutResult(photos: SyntheticPhoto[]): LayoutResult {
  devLogger.clear();
  const startTime = performance.now();
  
  const photoItems = photos.map(toPhotoItem);
  const settings = { shape: 'auto', gapColor: '#ffffff', gapSize: GAP_SIZE };
  
  const photoWeights: Record<string, number> = {};
  photos.forEach(p => { if (p.priority === 1) photoWeights[p.id] = 2; });
  
  const layout = generateCollageLayoutV3(photoItems, settings, { photoWeights });
  const durationMs = performance.now() - startTime;
  const logs = devLogger.getLogs();
  
  return { layout, logs, durationMs };
}
```

**2. Consolidated state:**

```typescript
interface TestState {
  photoSet: { photos: SyntheticPhoto[]; seed: number };
  layout: CollageLayout | null;
  logs: LogEntry[];
  durationMs: number;
}

const [state, setState] = useState<TestState>(() => {
  const photoSet = generateRandomSet();
  const result = generateLayoutResult(photoSet.photos);
  return { photoSet, ...result };
});
```

**3. Event handler with capture:**

```typescript
const handleShuffle = useCallback(() => {
  const photoSet = generateRandomSet();
  const result = generateLayoutResult(photoSet.photos);
  
  setState({ photoSet, ...result });
  
  // Capture to localStorage
  saveCapture(buildCapture(photoSet, result));
}, []);
```

**4. Build capture helper:**

```typescript
function buildCapture(
  photoSet: { photos: SyntheticPhoto[]; seed: number },
  result: LayoutResult
): Omit<V3LayoutCapture, 'exported'> {
  const { photos, seed } = photoSet;
  const { layout, logs, durationMs } = result;
  
  const heroPhoto = photos.find(p => p.priority === 1);
  const avgAR = photos.reduce((s, p) => s + p.aspectRatio, 0) / photos.length;
  const { rejectReasons, feasibilityReasons, rejectCount, feasibilityCount } = 
    extractReasonFrequencies(logs);
  
  return {
    photoCount: photos.length,
    heroCount: heroPhoto ? 1 : 0,
    heroAR: heroPhoto?.aspectRatio ?? null,
    avgAR,
    orientationBias: 0, // Could extract from generator if tracked
    seed,
    
    success: layout !== null,
    canvasWidth: layout?.width ?? null,
    canvasHeight: layout?.height ?? null,
    canvasAR: layout ? layout.width / layout.height : null,
    cellCount: layout?.cells.length ?? null,
    
    logCount: logs.length,
    rejectCount,
    rejectReasons,
    feasibilityCount,
    feasibilityReasons,
    durationMs,
    
    failureReason: layout ? null : getLastRejection()?.reason ?? 'unknown',
    failureDetails: layout ? null : getLastRejection()?.details ?? null,
    
    capturedAt: new Date().toISOString(),
  };
}
```

**5. Header UI:**

```text
+----------------------------------------------------------+
| V3 Layout Test                                           |
|                          [47 pending] [Export] [Shuffle] |
+----------------------------------------------------------+
```

- Pending count from `getCaptureStats().pending`
- Export button calls `exportPendingCaptures()` and triggers download
- Both update via `useState` for pending count

---

## Export Behavior

1. Click Export → `exportPendingCaptures()` returns pending captures
2. Download as `v3-captures-2026-02-07T12-30-00.json`
3. All exported captures marked `exported: true` in localStorage
4. Pending counter resets to 0

