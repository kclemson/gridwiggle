
## Reduce Aspect Ratio Weight in Scoring

Lower the `aspectDiff` weight so the algorithm favors uniform cell sizes over rigid aspect ratio matching. This will allow more layout variety (e.g., 3-row layouts for 24 photos when they produce better uniformity).

### The Change

**Before:**
```typescript
const totalScore = 
  aspectDiff * 2.0 +       // PRIMARY: match target aspect
  directionPenalty +       
  areaCV * 0.5 +           
  heightCV * 0.2 +         
  rowBalancePenalty;
```

**After:**
```typescript
const totalScore = 
  aspectDiff * 0.5 +       // Relaxed: allow aspect flexibility
  directionPenalty +       // Still hard gate on orientation direction
  areaCV * 1.0 +           // PROMOTED: uniform cell sizes now primary
  heightCV * 0.2 +         
  rowBalancePenalty;
```

### Weight Rationale

| Metric | Old Weight | New Weight | Reasoning |
|--------|------------|------------|-----------|
| `aspectDiff` | 2.0 | 0.5 | Demote from primary to secondary concern |
| `areaCV` | 0.5 | 1.0 | Promote to primary—uniform photos matter most |
| `directionPenalty` | 10.0 | 10.0 | Keep as hard gate (landscape must be wide) |
| `heightCV` | 0.2 | 0.2 | Keep light influence |
| `rowBalancePenalty` | ~0.3 | ~0.3 | Keep as-is |

### Expected Behavior

- Algorithm will explore 3, 4, 5+ row layouts more equally
- The winner will be whichever produces the most uniform cell sizes
- Orientation direction is still enforced (landscape stays wide, portrait stays tall)
- For 24 photos, you should now sometimes see 3-4 rows instead of always 5

### File to Modify

| File | Change |
|------|--------|
| `src/lib/collageLayout.ts` | Update weights on lines 177 and 179 |

### Testing

1. Upload 24 photos in landscape mode
2. Verify you sometimes get 3 or 4 rows instead of always 5
3. Toggle to portrait and confirm it still produces tall layouts
4. Verify drag-to-swap and export still work
