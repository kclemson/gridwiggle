

# Add Issue Tags to Hero Fraction Rating Tool

## Problem

The current hero fraction rating tool only captures good/bad/skip. When you rate something "bad," there's no way to record *why* -- was the hero too large? Was the template placement awkward? Was the shape a bad fit for the canvas? This makes it harder to derive specific rules from the data.

## What Changes

### 1. Add tag options to the rating UI

When rating "bad," the user can optionally check one or more reason tags. These appear as toggleable chips below the rating buttons (same pattern as the layout rating tool's `TagCheckboxes`).

**Proposed tags:**
- `hero-too-large` -- hero dominates too much of the canvas
- `hero-too-small` -- hero feels insignificant
- `bad-placement` -- template position doesn't work for this canvas/hero combo
- `bad-shape` -- hero shape clashes with canvas shape (slivers, etc.)

Tags are optional -- you can still just hit "bad" without tagging. Tags only appear for bad ratings (good/skip don't need reasons).

### 2. Update export format

Add a `tags` field to `HeroFractionRatingData`:

```text
tags: string[]   // e.g. ['hero-too-large'] or [] if untagged
```

This is additive -- existing fields are unchanged, so previously exported files remain valid.

### 3. No generator changes

The stratified sampling and template logic stay exactly as they are. This is purely a UI/data-capture improvement.

---

## Technical Details

### File: `src/test/layout/heroFractionGenerator.ts`

- Add `HERO_FRACTION_TAGS` constant array with the 4 tag strings
- Add `tags: string[]` field to `HeroFractionRatingData` interface

### File: `src/pages/HeroFractionRating.tsx`

- Add `selectedTags` state (`Set<string>`, reset when navigating to a new trial)
- When rating is "bad," show tag checkboxes between the rating buttons and navigation
- Tags are simple toggle chips (click to select/deselect)
- Include `tags` in the rating data on save
- When revisiting a previously-rated trial, restore its tags into `selectedTags`

### File: `src/components/hero-fraction/HeroFractionVisualization.tsx`

- No changes needed

