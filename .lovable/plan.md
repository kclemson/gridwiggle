# AR-Stratified Sampling + Fix Rejection Preview in App UI

## Status: ✅ COMPLETE

---

## Summary

Two changes implemented:
1. **AR-Stratified Sampling**: Photos distributed to BESIDE/BELOW regions by proportional sampling from AR buckets (Portrait/Square/Landscape) instead of sequential slicing
2. **Fix Rejection Preview**: Worker-to-main-thread log rehydration now preserves `level` and `rejectedLayout` fields

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Fix log rehydration to preserve `level` and `rejectedLayout` |
| `src/lib/v3/utils.ts` | Add `stratifiedARDistribution()` utility |
| `src/lib/v3/region-search.ts` | Replace sequential slicing with stratified distribution |

---

## Expected Results

### Rejection Preview Fix
- App UI debug logs now show underlined rejection entries
- Hovering displays the CSS box preview with AR labels

### AR-Stratified Sampling
- Both BESIDE and BELOW regions receive proportional mix of portrait/square/landscape photos
- Reduces "all portraits beside" clustering that causes prominence failures
- Layout success rate should improve for portrait-heavy photo sets
