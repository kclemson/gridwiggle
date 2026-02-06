
# Update canvas_minAR Default

## Summary

Change the default `canvas_minAR` from 0.5 to 0.67 to prevent overly tall portrait layouts while keeping the landscape range unchanged.

---

## Design Intent

**Problem**: The 1:2 portrait proportion (canvas_minAR = 0.5) feels visually awkward — too tall and narrow.

**Solution**: Raise the floor to 0.67, allowing at most a 1:1.5 portrait proportion.

**User Outcome**: Portrait-oriented collages stay comfortably proportioned (no taller than 1.5× their width) while landscape layouts can still stretch to 2:1.

---

## Change

### `src/lib/v3/types.ts`

Update the default value:

```typescript
// Before
canvas_minAR: 0.5,

// After  
canvas_minAR: 0.67,
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Change `canvas_minAR` default from 0.5 to 0.67 |
