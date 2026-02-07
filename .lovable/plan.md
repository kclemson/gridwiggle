

# Plan: Remove Quotes from Rejection Badge Values

## The Issue

The `RejectionBadge` component uses `JSON.stringify(v)` to render values, which adds quotes around strings:

```
besideCount: "8 (8-8)"
besideRowCount: "4 (1-4)"
```

## The Fix

Change line 24 in `src/components/debug/RejectionBadge.tsx` to render values directly for strings/numbers, only using `JSON.stringify` for complex objects:

```typescript
// Before
<div key={k}>{k}: {JSON.stringify(v)}</div>

// After  
<div key={k}>{k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>
```

## Expected Result

```
besideCount: 8 (8-8)
besideRowCount: 4 (1-4)
```

Clean display without quotes for string and number values.

