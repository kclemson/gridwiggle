# 2-Row Hero Layout: Implementation Complete

## Changes Made

### Fix 1: Unified Scaling (Eliminates Blank Rectangles)
- `packBesideAs2Rows` now returns `naturalTotalWidth` for horizontal-only scaling
- Beside cells are scaled **horizontally only** to fill remaining width after hero
- Hero and beside share the same height by construction (no vertical gaps)

### Fix 2: Remove Square Bias in Auto Mode
- In `collageLayout.ts`, Auto mode now passes `undefined` as targetAspect for hero layouts
- This lets the layout height emerge naturally from packing math
- Removes the tendency to average toward ~1.0 aspect ratio

### Fix 3: Iterative Beside Photo Count Selection
- `generateEdgeAnchoredHeroLayout` tries beside counts from 6 down to 4
- `generateMultiHeroLayout` uses the same iterative approach
- Relaxed tolerance to ±15% to find more working 2-row configurations
- Falls back to 1-row mode only when no 2-row config works

## Key Code Changes

### src/lib/heroLayout.ts
- `packBesideAs2Rows`: Added `naturalTotalWidth` return value
- `generateEdgeAnchoredHeroLayout`: Iterative beside count + horizontal-only scaling
- `generateFloatingHeroLayout`: Uses naturalTotalWidth for unified scaling
- `generateMultiHeroLayout`: Same iterative + unified approach

### src/lib/collageLayout.ts  
- Auto mode with heroes: Passes `undefined` targetAspect to let height emerge naturally

## Expected Results
1. No blank rectangles - unified scaling eliminates vertical gaps
2. Natural aspect ratios - Auto mode no longer pulls toward square
3. More successful 2-row layouts - iterative approach finds working configs
4. Hero always ~2× height of adjacent photos - guaranteed visual hierarchy
