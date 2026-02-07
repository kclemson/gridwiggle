

# Change Hero/Smallest Threshold to 22×

## Change

Update the default value for `hero_maxToSmallest` from `15` to `22` in `src/lib/v3/types.ts`.

## File to Modify

**`src/lib/v3/types.ts`** (line 68):

```typescript
// Before
hero_maxToSmallest: 15,

// After  
hero_maxToSmallest: 22,
```

## Impact

This is a more permissive threshold that will:
- Allow layouts where the hero is up to 22× larger than the smallest content photos
- Reduce the number of rejected layouts compared to 15×
- Still catch extreme cases like the ~41× ratio from the original screenshot

