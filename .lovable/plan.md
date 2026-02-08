

# Soft vs Hard Rejection (Dev-Only UI)

## Design Intent

Accept layouts that fall outside canvas aspect ratio bounds (soft rejections) instead of failing. In **dev mode only**, show amber styling and a "SOFT REJECTION" badge so you can diagnose borderline cases. In **production**, users see a normal collage with no indication anything was "off."

## User Outcomes

| Environment | Soft Rejection | Hard Rejection |
|-------------|----------------|----------------|
| **Production** | Normal collage (no indication) | Red rejection UI |
| **Dev Mode** | Collage with amber badge + details | Red rejection UI |

## Implementation

### 1. Add rejection severity types

**`src/lib/v3/types.ts`**

```typescript
/** Soft rejection reasons (layout exists but outside aesthetic bounds) */
export const SOFT_REJECTION_REASONS = ['canvas_too_tall', 'canvas_too_wide'] as const;

/** Check if a rejection reason is soft (aesthetic) vs hard (impossible) */
export function isSoftRejection(reason: string): boolean {
  return SOFT_REJECTION_REASONS.includes(reason as any);
}
```

Update `ScoredConfiguration`:
```typescript
export interface ScoredConfiguration {
  // ... existing fields ...
  
  /** Soft rejection info if layout is outside aesthetic bounds but still valid */
  softRejection?: {
    reason: string;
    details: Record<string, unknown>;
  };
}
```

### 2. Modify intersection.ts to accept soft rejections

**`src/lib/v3/intersection.ts`** (~lines 296-342)

Instead of returning `null` when canvas AR is out of bounds, mark it as a soft rejection and **continue** returning the valid configuration.

Current:
```typescript
if (canvasAR < effectiveMinAR) {
  // ... setRejectedLayout, devLogger ...
  return null;
}
```

New:
```typescript
let softRejection: ScoredConfiguration['softRejection'] = undefined;

if (canvasAR < effectiveMinAR) {
  softRejection = {
    reason: 'canvas_too_tall',
    details: { canvasAR, minAR: effectiveMinAR, ... }
  };
  devLogger.log('v3', 'Canvas AR below minimum (soft rejection)', { ... });
  // Continue instead of return null
}

// ... same for canvas_too_wide ...

// Attach to returned config
return { ...config, softRejection };
```

### 3. Update worker response type

**`src/workers/layoutWorker.ts`**

Add to `LayoutResponse`:
```typescript
export interface LayoutResponse {
  // ... existing fields ...
  
  /** Soft rejection info (dev-only display) */
  softRejection?: {
    reason: string;
    details: Record<string, unknown>;
  };
}
```

Pass through from config:
```typescript
const response: LayoutResponse = {
  type: 'result',
  requestId,
  layout,
  durationMs,
  logs: isDev ? workerLogs : undefined,
  softRejection: config?.softRejection, // Pass through if present
};
```

### 4. Create SoftRejectionBadge component (dev-only)

**`src/components/debug/SoftRejectionBadge.tsx`** (new file)

```tsx
import { AlertTriangle } from 'lucide-react';

interface SoftRejectionBadgeProps {
  reason: string;
  details: Record<string, unknown>;
}

export function SoftRejectionBadge({ reason, details }: SoftRejectionBadgeProps) {
  return (
    <div className="mt-3 p-4 bg-amber-500/20 border-2 border-amber-500 rounded-lg">
      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-lg">
        <AlertTriangle className="h-5 w-5" />
        SOFT REJECTION: {reason.replace(/_/g, ' ')}
      </div>
      <div className="mt-2 text-sm text-amber-600/80 dark:text-amber-400/80 font-mono">
        {Object.entries(details).map(([k, v]) => (
          <div key={k}>
            {k}: {typeof v === 'number' ? v.toFixed(3) : String(v)}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5. Update Index.tsx (dev-only rendering)

**`src/pages/Index.tsx`**

Add state for soft rejection:
```typescript
const [softRejection, setSoftRejection] = useState<{
  reason: string;
  details: Record<string, unknown>;
} | null>(null);
```

In worker response handler:
```typescript
setSoftRejection(response.softRejection ?? null);
```

In render, wrap amber treatment with dev check:
```tsx
{/* Successful layout */}
<div className={cn(
  "relative",
  // Dev-only amber ring for soft rejections
  import.meta.env.DEV && softRejection && "ring-2 ring-amber-500"
)}>
  <CollagePreview ... />
</div>

{/* Dev-only soft rejection badge */}
{import.meta.env.DEV && softRejection && (
  <SoftRejectionBadge 
    reason={softRejection.reason} 
    details={softRejection.details} 
  />
)}
```

### 6. Export from debug/index.ts

**`src/components/debug/index.ts`**

```typescript
export { SoftRejectionBadge } from './SoftRejectionBadge';
```

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Add `SOFT_REJECTION_REASONS`, `isSoftRejection()`, update `ScoredConfiguration` |
| `src/lib/v3/intersection.ts` | Accept soft rejections, attach to returned config |
| `src/workers/layoutWorker.ts` | Pass `softRejection` in response |
| `src/components/debug/SoftRejectionBadge.tsx` | New amber badge component |
| `src/components/debug/index.ts` | Export new component |
| `src/pages/Index.tsx` | Track `softRejection` state, render amber styling in dev only |

## Summary

- **Production**: Soft rejections are silently accepted → users see a normal collage
- **Dev mode**: Amber ring + badge shows you the layout was borderline
- **Hard rejections**: Red UI in both environments (unchanged)

