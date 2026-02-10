

# Fix Tag Chips: Always Visible, Select Before Rating

## Problem

Two issues with the current tag UI:

1. Tags only appear *after* a trial is rated "bad" (`currentRating === 'bad'`), but pressing B auto-advances to the next trial -- so you never see the chips for the trial you just rated.
2. The desired workflow is: look at the visualization, optionally select issue tags, *then* press B/G/S to confirm the rating and advance. Tags should be available before committing a rating.

## Solution

**Always show the tag chips** below the visualization (before the rating buttons). Selecting tags is just pre-loading your reasoning. When you press B, the selected tags get saved with the rating. When you press G or S, tags are cleared (they don't apply to good/skip ratings).

This also means auto-advance happens for all ratings (good, bad, skip), and tags reset on advance.

## Changes

### File: `src/pages/HeroFractionRating.tsx`

1. **Move tag chips above the rating buttons** and remove the `currentRating === 'bad'` conditional -- tags are always visible.

2. **Auto-advance on all ratings** including "bad" (currently bad doesn't advance). Tags get captured at rate-time from `selectedTags`.

3. **Remove the useEffect that persists tags on change** (line 52-60) -- no longer needed since tags are captured at rate-time, not retroactively synced.

4. **Keep the useEffect that restores tags when navigating back** (line 35-41) -- so revisiting a previously-rated trial shows its saved tags.

5. **Update keyboard hint** to mention tag selection workflow: "Select tags, then G/B/S to rate"

No other files change.

