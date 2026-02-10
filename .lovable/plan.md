

# Add Optional Notes Field to Hero Fraction Rating

## What Changes

A text area appears below the rating buttons where you can type free-form notes about any trial. Notes are saved with the rating data and included in the JSON export, giving full context for later analysis.

## User Experience

- A small text area sits below the tag chips, with placeholder text like "Optional notes about this trial..."
- Type anything you want before or after rating
- Notes are saved when you rate (Good/Bad/Skip) or when you navigate away
- When you navigate back to a previously-rated trial, your notes reappear
- Notes export in the JSON alongside the rating, tags, and scenario

## Technical Details

### File: `src/test/layout/heroFractionGenerator.ts`
- Add `notes?: string` to `HeroFractionRatingData`

### File: `src/pages/HeroFractionRating.tsx`
- Add `notes` state (`useState<string>('')`)
- Place a `<Textarea>` below the tag chips section
- Sync notes when navigating between trials (same pattern as tags -- read from the ratings map on index change)
- Include `notes` in the `rate()` function's data object
- When navigating to a rated trial, populate the textarea from saved data; when navigating to an unrated trial, clear it

No other files change. No database changes.

