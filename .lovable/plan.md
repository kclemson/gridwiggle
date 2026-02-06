

# Simple Dev Logger Utility

## Design

A minimal logger that:
- Calls `console.log` directly (shows in F12)
- Accumulates entries in an array for UI consumption
- Only active in dev mode

```typescript
// Usage in layout code:
devLogger.log('layout', 'Row selection', { heroAR: 0.67, optimalRows: 2 });

// Usage in Index.tsx:
devLogger.clear();
const layout = generateCollageLayout(...);
// Pass devLogger.getLogs() to DebugPanel
```

## Files to Change

### 1. Create `src/lib/devLogger.ts`

```typescript
export interface LogEntry {
  timestamp: number;
  category: string;
  label: string;
  data: Record<string, unknown>;
}

const isDev = import.meta.env.DEV;
let logs: LogEntry[] = [];

export const devLogger = {
  log(category: string, label: string, data: Record<string, unknown> = {}) {
    if (!isDev) return;
    console.log(`[${category}] ${label}`, data);
    logs.push({ timestamp: Date.now(), category, label, data });
  },

  clear() {
    logs = [];
  },

  getLogs(): LogEntry[] {
    return logs;
  },
};
```

### 2. Delete `src/lib/debugLogger.ts`

Remove the old `captureHeroLogs` wrapper.

### 3. Update `src/pages/Index.tsx`

```typescript
// Replace captureHeroLogs pattern:
import { devLogger } from '@/lib/devLogger';

// In regenerateCollage:
devLogger.clear();
const layout = generateCollageLayout(...);
setDebugLogs(devLogger.getLogs());
setLayout(layout);
```

### 4. Update `src/components/DebugPanel.tsx`

Change prop type from `HeroLogEntry` to `LogEntry`.

### 5. Add logging to `src/lib/layoutBlocks.ts`

```typescript
import { devLogger } from '@/lib/devLogger';

// In buildHeroUnitBlock:
devLogger.log('layout', 'Row selection', {
  heroAR: hero.aspectRatio,
  candidateCount: candidates.length,
  optimalRows,
  rowModesToTry,
});

// In tryBuildHeroUnit - on rejection/acceptance
devLogger.log('layout', 'Config rejected', { rowCount, reason: '...' });
devLogger.log('layout', 'Config accepted', { rowCount, besideCount, scaleFactor });
```

### 6. Add logging to `src/lib/heroLayout.ts`

```typescript
import { devLogger } from '@/lib/devLogger';

// After building hero block:
devLogger.log('layout', 'Hero block built', { besideCount, heroHeight });

// Before returning:
devLogger.log('layout', 'Layout complete', { totalBlocks, heroPctOfCanvas });
```

## Summary

| File | Action |
|------|--------|
| `src/lib/devLogger.ts` | Create (~25 lines) |
| `src/lib/debugLogger.ts` | Delete |
| `src/pages/Index.tsx` | Replace captureHeroLogs with devLogger |
| `src/components/DebugPanel.tsx` | Update import |
| `src/lib/layoutBlocks.ts` | Add 3-4 log calls |
| `src/lib/heroLayout.ts` | Add 2 log calls |

