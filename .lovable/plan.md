

## Expand Hero AR Range in Test Generator

### Design Intent
Allow the test generator to produce wider heroes (AR up to 3.0) so we can observe `beside=0` layouts where the hero spans the full canvas width.

### User Outcomes
- V3 test page will occasionally generate very wide heroes (panorama-style)
- This exposes the `beside=0` layout path that's currently unreachable due to narrow hero sampling
- Helps debug and validate the full-width hero geometry before adding edge mode

### The Change

**File: `src/test/layout/photoGenerator.ts`**

**Current behavior** (line 70-72):
```typescript
if (isHero) {
  // Hero biased toward landscape/square
  aspectRatio = sampleAspectRatio(0.3 + Math.random() * 0.4);
}
```
- Bias range: 0.3 to 0.7
- Resulting AR range: ~0.9 to ~1.6
- Never wide enough for `beside=0` with 20+ photos

**New behavior**:
```typescript
if (isHero) {
  // Hero spans from square to panorama
  // 70% chance: moderate landscape (AR 1.0-1.8)
  // 30% chance: wide panorama (AR 2.0-3.0)
  if (Math.random() < 0.3) {
    // Wide panorama hero - enables beside=0 layouts
    aspectRatio = 2.0 + Math.random() * 1.0;  // 2.0 to 3.0
  } else {
    // Standard landscape-biased hero
    aspectRatio = sampleAspectRatio(0.3 + Math.random() * 0.4);
  }
}
```

Also update the `MAX_ASPECT` constant to accommodate wider heroes:
```typescript
const MAX_ASPECT = 3.0;   // Panorama (was 2.0)
```

### Why These Numbers

For `beside=0` to be valid with canvas AR ≥ 0.67:
- With 20 content photos and belowHeight ~1.5, heroAR needs to be ≥ 2.0
- With 30 content photos and belowHeight ~2.0, heroAR needs to be ≥ 2.5
- AR 3.0 covers most realistic test cases

### Files Modified

| File | Change |
|------|--------|
| `src/test/layout/photoGenerator.ts` | Update `MAX_ASPECT` to 3.0; add 30% chance for wide panorama hero (AR 2.0-3.0) |

