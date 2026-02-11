
# Reorder and Relabel Layout Info Panel: Target/Actual Pairing

## What Changes

Single file edit to `src/components/debug/LayoutInfoPanel.tsx`. Two things:

1. **Prefix every metric with "target" or "actual"** (as discussed previously)
2. **Reorder lines so target/actual pairs sit together**

## New Line Order

```text
template: corner-anchor (bottom-left)

target area fraction: 0.275 [hero % of canvas used for photo split planning]
actual hero coverage: 33.7% of canvas

target canvas AR: 1.19
actual canvas AR: 0.96 (deviation: 19.3%)

actual hero AR: 1.50 | actual prominence: 4.37x [hero is 4.4x the largest content photo]

score: 0.872 | candidates: 11

region 0 (beside): 6 photos, w=0.24
  target rows: 3 | actual rows: 3

region 1 (below): 17 photos, h=0.51
  target rows: 8 | actual rows: 3
```

Key changes from current ordering:
- Area fraction (target) moves ABOVE hero coverage (actual) so the pair reads top-down: "we aimed for X, we got Y"
- Canvas AR split into two lines so target/actual pair vertically
- Region rows split into a sub-line with target then actual side by side
- All existing data preserved, just reordered and relabeled

## Technical Details

File: `src/components/debug/LayoutInfoPanel.tsx`, lines 42-84

The JSX block is reordered so the render sequence matches the target/actual pairing above. No props, interfaces, or data changes needed.
