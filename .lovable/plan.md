

# Persist Debug Logs with Collage State

## Design Intent

Allow debug sessions to survive page refreshes. When you reload the page, the last layout's debug logs are restored so you can continue investigating issues.

## User Outcome

- Refresh the page → debug panel shows the same logs as before
- Clear all photos → debug logs also clear
- Simple, automatic, no extra buttons

## Technical Approach

### 1. Extend Persisted State (`src/types/collage.ts`)

Add optional `debugLogs` to `PersistedCollageState`:

```typescript
export interface PersistedCollageState {
  photos: PhotoMetadata[];
  settings: CollageSettings;
  layout: CollageLayout | null;
  debugLogs?: LogEntry[];  // NEW - optional for backwards compatibility
}
```

### 2. Save Logs When Layout Changes (`src/hooks/useCollageState.ts`)

Import `devLogger` and include its logs when saving:

```typescript
import { devLogger, LogEntry } from '@/lib/devLogger';

// In saveMetadataToStorage():
const persisted: PersistedCollageState = {
  // ...existing fields
  debugLogs: devLogger.getLogs(),
};
```

### 3. Restore Logs on Load (`src/hooks/useCollageState.ts`)

In `loadMetadataFromStorage()`, return the logs if present:

```typescript
return {
  photos: parsed.photos || [],
  settings: { ...defaultSettings, ...parsed.settings },
  layout: parsed.layout || null,
  debugLogs: parsed.debugLogs || [],  // NEW
};
```

### 4. Hydrate devLogger on Mount

In the `initialize()` function, after loading persisted state:

```typescript
// Restore debug logs if present
if (persisted.debugLogs?.length) {
  persisted.debugLogs.forEach(log => devLogger.log(log.category, log.label, log.data, log.level));
}
```

### 5. Clear Logs on clearAll

Already handled - `clearAll` removes localStorage which includes logs.

## Files Modified

| File | Change |
|------|--------|
| `src/types/collage.ts` | Add optional `debugLogs` to `PersistedCollageState` |
| `src/hooks/useCollageState.ts` | Save logs in `saveMetadataToStorage`, restore in `initialize` |

## Size Consideration

Debug logs are typically small (50-200 entries, ~10-50KB). localStorage limit is 5MB. This is well within safe bounds.

