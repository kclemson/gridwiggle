

## Quiet Production Console Logging

### Design Intent
Reduce console noise in production while maintaining full remote telemetry. Only critical failures that users/developers need to see should appear in the browser console.

### User Outcomes
- **Production**: Console only shows layout failures with actionable error info
- **Development**: No change - all logs still visible for debugging
- **Remote logging**: Unchanged - all events still sent to the edge function for monitoring

---

### Changes

**`src/lib/remoteLogger.ts`**

Update the `log()` method to conditionally output to console:

```typescript
const isDev = import.meta.env.DEV;

export const remoteLogger = {
  log(level: 'info' | 'warn' | 'error', category: string, message: string, data?: Record<string, unknown>) {
    // In production: only log errors to console
    // In development: log everything to console
    if (isDev || level === 'error') {
      const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      consoleFn(`[${category}] ${message}`, data ?? '');
    }
    
    // Always buffer for remote sending (unchanged)
    logBuffer.push({
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    });
    
    // ... rest unchanged
  },
  // ...
};
```

**`src/pages/Index.tsx`**

Update the layout failure log to use `error` level so it appears in prod console:

```typescript
// Line 208: Change from info to error
remoteLogger.error('layout', 'Layout generation failed', {
  durationMs: workerResult?.durationMs,
  usedWorker: workerResult?.usedWorker ?? false,
  reason: workerResult?.failure?.reason ?? 'unknown',
});
```

---

### Behavior Matrix

| Environment | Log Level | Console Output | Remote Send |
|-------------|-----------|----------------|-------------|
| Dev         | info      | ✅             | ✅          |
| Dev         | warn      | ✅             | ✅          |
| Dev         | error     | ✅             | ✅          |
| **Prod**    | info      | ❌             | ✅          |
| **Prod**    | warn      | ❌             | ✅          |
| **Prod**    | error     | ✅             | ✅          |

---

### Files Modified
1. `src/lib/remoteLogger.ts` - Add dev check for console output
2. `src/pages/Index.tsx` - Change layout failure from `info` → `error`

