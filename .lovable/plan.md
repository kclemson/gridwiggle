
# Add Production Console Logging for V3 Layout Failures

## Problem

When the V3 layout fails to generate, there's no console output in production builds. The `devLogger` only operates in development mode, making it hard to diagnose failures in production.

## User Outcome

After this change, any layout generation failure will emit a `console.warn` with:
- Photo count and hero info
- The specific reason for failure (e.g., "Canvas too tall", "Hero too large vs smallest cells")
- Key metrics that caused the rejection

This helps diagnose issues without needing to reproduce in dev mode.

## Technical Changes

### File: `src/lib/v3/index.ts`

**Add failure logging at the entry point** (around line 130-133):

```typescript
// Current:
if (!config) {
  devLogger.log('v3', 'No valid configuration found');
  return null;
}

// After:
if (!config) {
  devLogger.log('v3', 'No valid configuration found');
  console.warn('[V3 Layout] Generation failed', {
    photoCount: photos.length,
    heroCount,
    avgAR: (dimensions.reduce((s, d) => s + d.aspectRatio, 0) / dimensions.length).toFixed(2),
  });
  return null;
}
```

### File: `src/lib/v3/intersection.ts`

**Add failure reason tracking** - return detailed rejection info that bubbles up to the entry point. Modify each rejection point to include the reason:

1. **Canvas too tall** (line 263-268):
```typescript
// Add reason to a returned object or track in a module-level variable
```

2. **Canvas too wide** (line 271-276)
3. **Prominence too low** (line 284-289)  
4. **Hero too large vs smallest** (line 295-301)

The cleanest approach is to have `findValidConfiguration` track the last rejection reason and include it in the final log.

### Implementation Strategy

Add a simple rejection tracking mechanism:

```typescript
// In intersection.ts - track last rejection
let lastRejectionReason: { reason: string; details: Record<string, unknown> } | null = null;

function setRejection(reason: string, details: Record<string, unknown>) {
  lastRejectionReason = { reason, details };
}

export function getLastRejection() {
  return lastRejectionReason;
}

export function clearRejections() {
  lastRejectionReason = null;
}
```

Then in `index.ts`:

```typescript
import { findValidConfiguration, getLastRejection, clearRejections } from './intersection';

// Before search
clearRejections();

// After failure
if (!config) {
  const rejection = getLastRejection();
  console.warn('[V3 Layout] Generation failed', {
    photoCount: photos.length,
    heroCount,
    ...rejection?.details,
    reason: rejection?.reason ?? 'No valid proposals',
  });
  return null;
}
```

## Summary

| File | Change |
|------|--------|
| `src/lib/v3/intersection.ts` | Add `setRejection`, `getLastRejection`, `clearRejections` helpers |
| `src/lib/v3/intersection.ts` | Call `setRejection` at each validation failure point |
| `src/lib/v3/index.ts` | Log failure with `console.warn` including rejection reason |
