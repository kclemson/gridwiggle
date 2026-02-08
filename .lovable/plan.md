
# Plan: Remove Header Rejection Banner from V3Test

## What We're Changing

Remove the redundant red "REJECTED" banner that appears in the page header next to "V3 Layout Test". The rejection reason and details are already displayed via the `RejectionBadge` component directly beneath the layout visualization, making the header banner unnecessary.

## Current State

The header currently shows:
```
V3 Layout Test  [REJECTED: hero too large vs smallest cells]    [buttons...]
```

## After Change

The header will simply show:
```
V3 Layout Test                                                   [buttons...]
```

Rejection information remains visible under the layout canvas via the existing `RejectionBadge` component.

## Technical Change

**File**: `src/pages/V3Test.tsx`

Remove lines 287-292:
```tsx
{!layout && rejectedLayout && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md">
    <AlertTriangle className="h-4 w-4" />
    <span className="font-medium text-sm">REJECTED: {rejectedLayout.reason.replace(/_/g, ' ')}</span>
  </div>
)}
```

Also remove the unused `AlertTriangle` import from lucide-react since it won't be needed after this change.

## Files to Modify

1. **`src/pages/V3Test.tsx`** - Remove header rejection banner and unused import
