

## Reduce Ultra-Wide Hero Frequency to 10%

### Design Intent
Make test case distribution more representative of typical usage by reducing the frequency of ultra-wide panoramic heroes (AR 2.0-3.0).

### User Outcome
When shuffling through test layouts, ultra-wide heroes will appear roughly 1 in 10 times instead of 1 in 3, making the test suite focus more on common hero shapes while still covering the wide panorama case.

---

## Changes

### File: `src/test/layout/photoGenerator.ts`

Update line 56 to change the probability from 0.3 to 0.1:

```typescript
// Before (line 56)
if (Math.random() < 0.3) {

// After
if (Math.random() < 0.1) {
```

Also update the comment to reflect the new frequency:

```typescript
// Before (line 57-58)
// Wide panorama hero - enables beside=0 layouts
aspectRatio = 2.0 + Math.random() * 1.0;

// After
// 10% chance: wide panorama hero (AR 2.0-3.0)
aspectRatio = 2.0 + Math.random() * 1.0;
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/test/layout/photoGenerator.ts` | Change ultra-wide hero probability from 30% to 10% |

