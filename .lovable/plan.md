
# Make V3 the Default Algorithm Version

## Change

Update the initial state of `algorithmVersion` from `'v1'` to `'v3'` in `src/pages/Index.tsx`.

## File to Modify

| File | Line | Change |
|------|------|--------|
| `src/pages/Index.tsx` | 50 | Change `useState<AlgorithmVersion>('v1')` to `useState<AlgorithmVersion>('v3')` |

## Code Change

```typescript
// Before (line 50)
const [algorithmVersion, setAlgorithmVersion] = useState<AlgorithmVersion>('v1');

// After
const [algorithmVersion, setAlgorithmVersion] = useState<AlgorithmVersion>('v3');
```

This ensures V3 is selected by default when the debug panel loads, so you can immediately test the new layout engine without having to click the toggle each time.
