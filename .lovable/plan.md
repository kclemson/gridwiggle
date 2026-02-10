

# Fix: Save Notes on Navigation

## Problem
Notes are only saved when you click Good/Bad/Skip. If you type notes and then click Next or Prev (or use arrow keys), the index changes, the useEffect fires, and your text is wiped because it was never stored in the ratings map.

## Solution
Before changing `currentIndex`, persist the current notes into the ratings map. This way the useEffect will find them when you navigate back.

## Technical Changes

### File: `src/pages/HeroFractionRating.tsx`

1. **Add a `saveNotes` helper** that writes the current notes into the ratings map for `currentIndex` (merging with any existing rating data, or creating a minimal placeholder entry if unrated).

2. **Call `saveNotes` inside `goPrev` and `goNext`** before changing the index, so the text is persisted before the useEffect clears it.

3. The useEffect on `currentIndex` already restores `notes` from the ratings map, so no changes needed there -- it will now find the saved notes.

This is a small, focused fix -- about 10 lines of new code total.

