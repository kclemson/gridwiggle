

# Document Hero Placement Rules (No Enforcement)

## Goal

Capture the validated rules from Rounds 1-4 in a single reference file. No engine changes, no validation logic, no tuning parameter additions. Just a well-organized document so the rules don't get lost while we continue discussing other changes.

## What Changes

### New file: `src/lib/v3/hero-constraints.ts`

A documentation-only file containing the complete validated rule set:

```typescript
/**
 * Hero Placement Constraints
 * 
 * Derived from 4 rounds of visual rating (~120 trials).
 * These are NOT enforced in the engine yet — this file serves
 * as the single source of truth for when we're ready to encode them.
 *
 * SINGLE HERO:
 * - General area range: 0.15 - 0.60
 * - Square canvas (AR 0.85-1.15) ceiling: 0.35
 * - Floor TBD (not yet stress-tested below 0.20)
 *
 * DUAL HERO:
 * - Combined area range: 0.22 - 0.42
 *
 * TEMPLATE RESTRICTIONS:
 * - Band templates (top/bottom/left/right-band): 
 *     only on square-ish canvases (AR 0.85-1.15)
 * - side-by-side: banned on portrait canvases
 * - top-bottom: banned on landscape canvases
 *
 * RELIABLE TEMPLATES:
 * - corner-anchor: works on all canvas shapes
 * - diagonal-corners: works on all canvas shapes (dual hero)
 */
```

No other files are touched. No tuning params, no validation functions, no engine integration.

| File | Change |
|------|--------|
| `src/lib/v3/hero-constraints.ts` | New file: documented rule set only |

