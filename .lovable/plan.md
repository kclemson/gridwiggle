

# Tags Auto-Rate as "Bad"

## What Changes

Clicking a tag chip will now **simultaneously select that tag AND submit a "bad" rating** for the current trial. This removes the two-step process -- one click does both.

- Clicking a tag = rate as "bad" with that tag selected, then auto-advance
- Multiple tags: if you want multiple tags, navigate back after rating and click additional tags (which will update the saved rating)
- G and S keyboard shortcuts still work for good/skip ratings without tags

## Technical Details

### File: `src/pages/HeroFractionRating.tsx`

1. **Update `toggleTag`** to also call `rate('bad')` with the newly toggled tag included. Since `rate` reads from `selectedTags` state and state updates are batched, we need to compute the new tag set inline and pass it directly to rate.

2. **Modify `rate` to accept an optional `tagsOverride` parameter** so `toggleTag` can pass the updated tags directly (avoiding stale state from the `selectedTags` Set not yet being updated).

3. When navigating back to a rated trial and clicking another tag, it updates the existing rating's tags and re-saves (stays on the same trial so you can review).

