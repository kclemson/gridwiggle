# Hero Layout Improvements - IMPLEMENTED ✓

## Summary

Fixed three issues with hero layouts:

1. **✓ Row 2 bottom gaps eliminated** - Added explicit row alignment functions (`fixRowAlignment2Row`, `fixRowAlignment3Row`) that force each row's Y position to align perfectly with hero bottom after scaling.

2. **✓ Vertical position variety** - Added 30% chance for "intro rows" before hero zone when 8+ photos. Hero no longer always appears at top.

3. **✓ 3-row layouts now trigger** - Relaxed tolerance from ±15% to ±20%, expanded beside count range from 12→3.

## Key Changes in `src/lib/heroLayout.ts`

- `packBesideAs2Rows` now returns `row1Height` and `row2Height` for alignment fix
- `packBesideAs3Rows` returns individual row heights and uses better splitting
- `fixRowAlignment2Row()` - Fixes row 2 Y to `heroHeight - row2Height`
- `fixRowAlignment3Row()` - Fixes all 3 rows' Y positions
- `generateEdgeAnchoredHeroLayout` now supports intro rows and applies alignment fixes

## Visual Result

```text
Layout A - Standard (hero top):
┌──────────┬───────────────┐
│          │ A │ B │ C     │ ← No gap!
│   HERO   ├───────────────┤
│          │   D   │ E     │
└──────────┴───────────────┘

Layout B - With intro rows (hero lower):
┌────────────────────────────┐
│ X │ Y │ Z │ W              │ ← Hero NOT at top
├──────────┬─────────────────┤
│          │ A │ B │ C       │
│   HERO   ├─────────────────┤
│          │   D   │ E       │
└──────────┴─────────────────┘

Layout C - 3-row (large sets):
┌──────────┬─────────────────┐
│          │ A │ B │ C       │
│          ├─────────────────┤
│   HERO   │  D  │  E        │
│          ├─────────────────┤
│          │ F │ G │ H       │
└──────────┴─────────────────┘
```
