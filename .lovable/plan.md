

## Fix Missing Debug Logs in Main App

### Design Intent
The main app uses a Web Worker for layout generation, but the worker's isolated JavaScript context means logs from the V3 algorithm (which uses `devLogger`) are lost. We need to make `devLogger` support log collection in worker contexts.

### User Outcome
Debug logs in the main app will show the same detailed, color-coded rejection reasons, feasibility checks, and region search data as the V3Test tool - enabling proper debugging of layout failures.

---

## Root Cause Analysis

```text
V3Test (works):                           Main App (broken):
┌─────────────────────────┐               ┌─────────────────────────┐
│ V3Test.tsx              │               │ Index.tsx               │
│   generateCollageV3()───┼──┐            │   generateLayoutInWorker()
└─────────────────────────┘  │            └───────────┬─────────────┘
                             │                        │
                             ▼                        ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│ v3/index.ts             │               │ Worker Thread           │
│   devLogger.log() ──────┼──┐            │   workerLogger.log()  ◄──── Only 4 calls
└─────────────────────────┘  │            │   findValidConfiguration()
                             │            │      └─► devLogger.log()──► Lost!
                             ▼            └─────────────────────────┘
┌─────────────────────────┐
│ v3/intersection.ts      │
│   devLogger.log() ──────┼──┐
└─────────────────────────┘  │
                             │
                             ▼
┌─────────────────────────┐
│ devLogger logs array    │  ◄── Same array, all logs collected
└─────────────────────────┘
```

**Problem:** In the worker, `devLogger` writes to a separate isolated array that's never returned.

---

## Solution: Add Log Collector to devLogger

Modify `devLogger` to support a collector mode:

```typescript
// src/lib/devLogger.ts

let logs: LogEntry[] = [];
let collector: ((entry: LogEntry) => void) | null = null;

export const devLogger = {
  log(category, label, data, level) {
    if (!isDev) return;
    
    const entry = { timestamp: Date.now(), category, label, data, level };
    
    // If collector is set (worker mode), use it
    if (collector) {
      collector(entry);
    } else {
      // Normal mode - log to console + array
      console.log(`[${category}] ${label}`, data);
      logs.push(entry);
    }
  },
  
  // Set a custom collector (for worker contexts)
  setCollector(fn: (entry: LogEntry) => void | null) {
    collector = fn;
  },
  
  // ... rest unchanged
};
```

---

## Worker Changes

Update the worker to redirect `devLogger` to its own array:

```typescript
// src/workers/layoutWorker.ts

import { devLogger, LogEntry } from '@/lib/devLogger';

// Worker-local log collection
let logs: LogEntry[] = [];

// Redirect devLogger to our local array
devLogger.setCollector((entry) => {
  logs.push(entry);
});

// In generateLayout:
function generateLayout(...) {
  logs = [];  // Clear at start
  
  // Now all devLogger.log() calls from v3/*.ts go to our logs array
  const config = findValidConfiguration(dims, normalizedGap, tuning, randomize);
  
  // Return logs with response
}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/devLogger.ts` | Add `setCollector()` method for worker contexts |
| `src/workers/layoutWorker.ts` | Redirect devLogger to worker-local collection, remove duplicated `workerLogger` |

---

## Technical Details

### 1. devLogger.ts Changes

```typescript
// Add collector support
let collector: ((entry: LogEntry) => void) | null = null;

export const devLogger = {
  log(category: string, label: string, data: Record<string, unknown> = {}, level: 'info' | 'warn' | 'error' = 'info') {
    if (!isDev) return;
    
    const entry: LogEntry = { timestamp: Date.now(), category, label, data, level };
    
    // Collector mode (worker) - skip console, just collect
    if (collector) {
      collector(entry);
      return;
    }
    
    // Normal mode - console + local array
    const consoleMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleMethod(`[${category}] ${label}`, data);
    logs.push(entry);
  },

  // Set collector for worker contexts
  setCollector(fn: ((entry: LogEntry) => void) | null) {
    collector = fn;
  },
  
  // Check if in collector mode
  hasCollector(): boolean {
    return collector !== null;
  },

  // ... existing methods unchanged
};
```

### 2. layoutWorker.ts Changes

Remove the separate `workerLogger` and use redirected `devLogger`:

```typescript
import { devLogger, LogEntry } from '@/lib/devLogger';
import { findValidConfiguration, getLastRejection, clearRejections } from '@/lib/v3/intersection';

// Worker-local log storage
let workerLogs: LogEntry[] = [];

// Redirect all devLogger calls to worker-local array
devLogger.setCollector((entry) => {
  workerLogs.push(entry);
});

function generateLayout(dimensions, normalizedGap, tuningOverrides, randomize) {
  // Clear worker logs at start of each generation
  workerLogs = [];
  
  // ... existing generation logic ...
  // All devLogger.log() calls from v3/*.ts now go to workerLogs
  
  const config = findValidConfiguration(dims, normalizedGap, tuning, randomize);
  
  // ...
}

// In message handler:
self.onmessage = (e) => {
  // ...
  const layout = generateLayout(...);
  
  const response = {
    // ...
    logs: isDev ? workerLogs : undefined,  // Use collected logs
  };
  
  self.postMessage(response);
};
```

---

## Expected Result

After this fix:
- Main app debug panel will show 30+ detailed logs instead of 3
- Region search rejections will be visible with exact values
- Feasibility checks will be logged
- Same debugging experience as V3Test

