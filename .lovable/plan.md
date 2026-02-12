
# Add Photo Count Scale Factor to Layout Info Panel

## What Changes

Two small additions so you can see at a glance how the photo-count scaling is affecting hero constraints.

## 1. `src/lib/v4/index.ts` (~line 1104)

Add one field to the `layoutMeta` object:

```typescript
photoCountScaleFactor: photoCountScale(dimensions.length),
```

## 2. `src/components/debug/LayoutInfoPanel.tsx`

Destructure `photoCountScaleFactor` from meta alongside the existing fields (~line 77).

After the "target area fraction" line (~line 98), insert:

```
photo count scale: 0.56 (46 photos)
  [1.0 = no tapering (<=20 photos); lower = hero claims less area & prominence.
   Formula: clamp(20 / photoCount, 0.55, 1.0)]
```

- When scale is 1.0: dimmed text (no tapering active, not worth highlighting)
- When scale is less than 1.0: amber text to flag that tapering is in effect

Two files modified, no new files.
