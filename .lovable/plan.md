

## Fix: Misleading "Layout generated" Log

### The Problem
The log `[layout] Layout generated` is emitted **unconditionally** after the worker returns, regardless of whether layout generation succeeded or failed. This creates a confusing disconnect between the console (which says "generated") and the UI (which shows an error).

**Current flow in `src/pages/Index.tsx` lines 183-210:**
```text
1. Worker returns result (layout may be null)
2. Log "Layout generated" with cells: 0  ← ALWAYS runs
3. Check if layout exists
   - If yes: apply layout, clear error
   - If no: show error in UI
```

### The Solution
Move the "Layout generated" log **inside** the success branch, so it only logs when a layout is actually produced. Optionally add a separate log for failures.

### Changes

**`src/pages/Index.tsx` (around lines 183-210)**

**Before:**
```typescript
remoteLogger.info('layout', 'Layout generated', {
  cells: layout?.cells.length ?? 0,
  durationMs: result.durationMs,
  usedWorker: result.usedWorker,
});

// ... later ...

if (layout) {
  setLayout(layout);
  setLayoutError(null);
  remoteLogger.info('layout', 'Layout applied', { cells: layout.cells.length });
} else if (state.layout) {
  setLayoutError("Couldn't generate a new layout...");
}
```

**After:**
```typescript
// Remove unconditional log here

// ... later ...

if (layout) {
  setLayout(layout);
  setLayoutError(null);
  remoteLogger.info('layout', 'Layout generated', {
    cells: layout.cells.length,
    durationMs: result.durationMs,
    usedWorker: result.usedWorker,
  });
} else {
  remoteLogger.info('layout', 'Layout generation failed', {
    durationMs: result.durationMs,
    usedWorker: result.usedWorker,
    reason: result.failure?.reason ?? 'unknown',
  });
  if (state.layout) {
    setLayoutError("Couldn't generate a new layout...");
  }
}
```

### User Outcome
- Console logs now accurately reflect success vs failure
- `[layout] Layout generated` only appears when a layout is actually produced
- `[layout] Layout generation failed` appears when generation returns null
- No more confusing mismatch between console and UI state

