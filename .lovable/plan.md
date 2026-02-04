# Hero Layout Algorithm - Next Steps

## Completed

### Phase 1: Remove Smart Crop Console Log ✓
- Removed detailed smart crop logging from `src/pages/Index.tsx` (lines 137-141)

### Phase 4: Add Algorithm Debug Logging ✓
- Added structured console logs at key decision points in `src/lib/heroLayout.ts`:
  - `[Collage] Layout requested` - Entry point with photo counts and target aspect
  - `[Hero] Strategy` - Strategy selection (edge-anchored vs floating)
  - `[Hero] Edge-anchored config` - Edge-anchored layout configuration
  - `[Hero] Trying config` - Each row packing attempt with scale factor and acceptance
  - `[Hero] Layout complete` - Final layout metrics including hero % of canvas
  - `[Hero] Fallback triggered` - When and why fallbacks occur

---

## Next Steps (Pending)

### Phase 2: Simplify Shape Control
- Remove Shape dropdown from `src/components/CollageSettings.tsx`
- Let algorithm have full freedom over final shape

### Phase 3: Redesign Hero Layout with Area Target
- Implement target hero area % based on photo count
- Enforce MIN_BESIDE_ROWS = 2 (never 1-row for 4+ photos)
- Allow ±10% crop flexibility
- Score configurations based on area target and aspect ratio fit

---

## How to Use the Logs

Filter console by `[Hero]` to see only layout decisions:
- Strategy chosen (edge-anchored vs floating)
- How many photos tried packing beside hero
- Whether scale factors were within tolerance
- Actual hero size as % of canvas
- Final aspect ratio
