

# Soften Dev Info Panel for Soft Rejections

## Problem Summary

The current soft rejection UI is too attention-grabbing:
1. Amber ring around the entire canvas adds visual noise
2. "SOFT REJECTION:" header with warning icon feels alarming for what's just informational metadata

---

## Design Intent

**What behavior do we want?**
- Soft rejections are informational, not warnings - they indicate the layout is usable but outside ideal bounds
- Dev should see the metrics without being distracted from the actual collage

**What will developers experience?**
- Clean canvas without border artifacts
- Subtle info panel that blends into the dev UI without demanding attention

---

## Implementation Details

### Remove Amber Ring from Index.tsx

**File: `src/pages/Index.tsx`**

Remove the conditional amber ring class at line 711:

```typescript
// Before
<div className={cn(
  "relative overflow-hidden transition-opacity duration-150",
  isGenerating && "opacity-60",
  // Dev-only amber ring for soft rejections
  import.meta.env.DEV && softRejection && "ring-2 ring-amber-500 rounded-lg"
)}>

// After
<div className={cn(
  "relative overflow-hidden transition-opacity duration-150",
  isGenerating && "opacity-60"
)}>
```

### Rename and Restyle the Badge Component

**File: `src/components/debug/SoftRejectionBadge.tsx`**

Transform from warning badge to informational panel:

| Element | Before | After |
|---------|--------|-------|
| Component name | `SoftRejectionBadge` | `LayoutInfoPanel` |
| Background | `bg-amber-500/20` | `bg-muted/50` |
| Border | `border-2 border-amber-500` | `border border-border` |
| Header icon | `AlertTriangle` (warning) | `Info` (informational) |
| Header text | `SOFT REJECTION: {reason}` | `Layout Info` |
| Header style | `text-amber-600 font-bold text-lg` | `text-muted-foreground text-sm font-medium` |
| Reason display | Part of header | Shown as first data row |
| Text colors | amber throughout | muted-foreground |

**New structure:**
```tsx
import { Info } from 'lucide-react';

export function LayoutInfoPanel({ reason, details }: LayoutInfoPanelProps) {
  return (
    <div className="mt-3 p-3 bg-muted/50 border border-border rounded-lg">
      <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-medium mb-2">
        <Info className="h-4 w-4" />
        Layout Info
      </div>
      <div className="text-xs text-muted-foreground/80 font-mono space-y-0.5">
        <div>reason: {reason.replace(/_/g, ' ')}</div>
        {/* ...existing detail rows... */}
      </div>
    </div>
  );
}
```

### Update Export in debug/index.ts

**File: `src/components/debug/index.ts`**

Rename the export from `SoftRejectionBadge` to `LayoutInfoPanel`.

### Update Import in Index.tsx

**File: `src/pages/Index.tsx`**

Update the import and usage:
```typescript
// Before
import { SoftRejectionBadge } from '@/components/debug';
// ...
<SoftRejectionBadge reason={...} details={...} />

// After
import { LayoutInfoPanel } from '@/components/debug';
// ...
<LayoutInfoPanel reason={...} details={...} />
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Remove amber ring class, rename `SoftRejectionBadge` → `LayoutInfoPanel` |
| `src/components/debug/SoftRejectionBadge.tsx` | Rename to `LayoutInfoPanel.tsx`, restyle as subtle info panel |
| `src/components/debug/index.ts` | Update export name |

---

## Visual Comparison

**Before:**
```
┌─────────────────────────────────┐
│  ╔═══════════════════════════╗  │  ← amber ring around canvas
│  ║                           ║  │
│  ║       [collage]           ║  │
│  ║                           ║  │
│  ╚═══════════════════════════╝  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ⚠ SOFT REJECTION: reason  │  │  ← bright amber warning
│  │ detail: 0.123             │  │
│  │ detail2: 0.456            │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**After:**
```
┌─────────────────────────────────┐
│                                 │
│       [collage]                 │  ← no border/ring
│                                 │
│                                 │
│  ┌───────────────────────────┐  │
│  │ ℹ Layout Info             │  │  ← subtle muted panel
│  │ reason: canvas too tall   │  │
│  │ detail: 0.123             │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

