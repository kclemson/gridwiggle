
# Bump hero_maxToSmallest from 22 to 45

## The Problem

The current threshold of 22 is rejecting layouts that look visually acceptable. Your debug screenshots show ratios of 22.5, 31, 42.7, and 29.8 all being rejected - layouts where the hero-to-smallest ratio is larger than 22 but the visual result is still perfectly good.

## The Fix

Update `src/lib/v3/types.ts` line 61:

```typescript
// Before
hero_maxToSmallest: 22,

// After  
hero_maxToSmallest: 45,
```

Also update the JSDoc comment on line 47-48 to match:

```typescript
// Before
/** Max hero area relative to avg of smallest content photos (15 = hero ≤ 15× smallest) */

// After
/** Max hero area relative to avg of smallest content photos (45 = hero ≤ 45× smallest) */
```

## Impact

- Layouts with hero-to-smallest ratios between 22 and 45 will now be accepted
- This is more permissive, allowing greater variation in photo sizes
- Based on your visual inspection, these ratios still produce acceptable layouts
- Easy to tune further if 45 proves too loose or too tight

---

## File Changes

| File | Change |
|------|--------|
| `src/lib/v3/types.ts` | Update `hero_maxToSmallest` from 22 to 45, update comment |
