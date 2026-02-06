
# Fix: Constrain Log Category Column to Prevent Spill

## Problem
The left column in the debug logs (`[v3-split] Valid split candidate`) isn't width-constrained, causing text to spill over the data column on the right side.

## Visual Explanation
Current: 
```
[v3-split] Valid split candidate    besideCount:4, besideRowCount:3...
           ↑ This text overflows → → →
```

Desired:
```
[v3-split] Valid split     besideCount:4, besideRowCount:3...
           candidate       (text wraps within its column)
```

## Technical Fix

### File: `src/pages/V3Test.tsx`

**Line 183-186** - The log entry layout needs to:
1. Keep the 2-column grid structure
2. Add `overflow-hidden` or proper width constraints
3. Allow the label to wrap within its column instead of `whitespace-nowrap`

```typescript
// Current (line 183):
<div key={idx} className="grid grid-cols-[260px_1fr] gap-2">
  <div className="flex gap-1 shrink-0">
    <span className="text-blue-500">[{entry.category}]</span>
    <span className="text-foreground whitespace-nowrap">{entry.label}</span>
  </div>

// Fixed:
<div key={idx} className="grid grid-cols-[260px_1fr] gap-2">
  <div className="flex gap-1 overflow-hidden">
    <span className="text-blue-500 shrink-0">[{entry.category}]</span>
    <span className="text-foreground truncate" title={entry.label}>{entry.label}</span>
  </div>
```

Key changes:
- Remove `shrink-0` from the container (it was preventing width constraint)
- Add `overflow-hidden` to the container
- Add `shrink-0` to the category badge (keeps `[v3-split]` intact)
- Replace `whitespace-nowrap` with `truncate` on the label (or we could allow wrapping)

**Alternative: Allow wrapping instead of truncation:**
```typescript
<div className="flex gap-1 min-w-0">
  <span className="text-blue-500 shrink-0">[{entry.category}]</span>
  <span className="text-foreground break-words min-w-0">{entry.label}</span>
</div>
```

This allows the label text to wrap to multiple lines within the 260px column.

## Recommendation

Use **wrapping** rather than truncation since seeing the full log label is valuable for debugging. The `break-words` + `min-w-0` combo will keep text within its column while allowing it to flow to the next line.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/V3Test.tsx` | Fix log column overflow by allowing text wrapping within the 260px left column |
