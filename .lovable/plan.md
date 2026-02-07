

## Remove 50-Photo Count from Test Generation

### Design Intent
Simplify test case generation by removing edge cases that combine multiple rare factors (very high photo count + wide panoramic hero).

### User Outcome
The V3 test page will generate layouts with up to 35 photos, avoiding the geometric impossibility cases that arise when 50 photos combine with wide heroes.

---

## Changes

### File: `src/test/layout/photoGenerator.ts`

Update line 12 to remove `50` from the test counts array:

```typescript
// Before
export const TEST_PHOTO_COUNTS = [5, 6, 8, 9, 10, 12, 14, 16, 17, 20, 23, 30, 35, 50] as const;

// After
export const TEST_PHOTO_COUNTS = [5, 6, 8, 9, 10, 12, 14, 16, 17, 20, 23, 30, 35] as const;
```

---

## Files Modified

| File | Changes |
|------|---------|
| `src/test/layout/photoGenerator.ts` | Remove `50` from `TEST_PHOTO_COUNTS` array |

