

# Widen Debug Logs Panel

## Current State
The log panel is fixed at 400px width (`lg:grid-cols-[400px_1fr]`), causing significant text wrapping in the JSON data output.

## Change
Increase the log panel width from 400px to 520px to reduce wrapping while still leaving ample room for the canvas visualization.

### File: `src/pages/V3Test.tsx`

**Line 74** - Update grid column definition:
```tsx
// Before
<div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">

// After  
<div className="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-6">
```

This gives the logs ~30% more horizontal space, which should significantly reduce line wrapping for the JSON data objects while still maintaining a comfortable canvas viewing area on the right.

