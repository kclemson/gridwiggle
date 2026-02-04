# 2-Row Hero Layout - IMPLEMENTED

## Summary

The hero layout now uses 2-row beside packing to guarantee visual dominance:

1. **Hero spans 2 rows** - Pack beside photos into 2 rows first, hero height = combined height
2. **Guaranteed size hierarchy** - Hero is always ~2× larger than any adjacent photo
3. **Reduced width fractions** - Hero takes 35-55% width (reduced since it's now taller)
4. **Tolerance-based scaling** - ±10% scaling to eliminate blank rectangles
5. **Fallback to 1-row** - For < 4 standard photos

## Key Functions Updated

- `packBesideAs2Rows` - NEW: Packs photos into exactly 2 rows, returns combined height
- `packBesideAs1Row` - NEW: Single-row fallback with tolerance scaling
- `generateEdgeAnchoredHeroLayout` - Uses 2-row packing, hero adapts to combined height
- `generateFloatingHeroLayout` - 2-row packing on both sides of centered hero
- `generateMultiHeroLayout` - Each hero uses 2-row packing independently
- `calculateHeroWidthFraction` - Reduced fractions (35-55%) since hero is now 2-rows tall

