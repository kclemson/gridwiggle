

## Unified Fix: Increase Aspect Ratio Weight in Scoring

Instead of adding special-case code for square mode, increase the weight of `aspectDiff` in the scoring formula so *all* orientations adhere more tightly to their target shapes.

---

## Current Scoring Weights

```typescript
const totalScore = 
  aspectDiff * 0.5 +       // Currently very low - easily overridden
  directionPenalty +       
  areaCV * 1.0 +           // Uniformity dominates
  heightCV * 0.2 +         
  rowBalancePenalty;
```

With `aspectDiff * 0.5`, a layout with 20% aspect deviation only adds 0.1 to the score. A slightly more uniform layout can easily win despite being way off the target shape.

---

## Proposed Change

**File: `src/lib/collageLayout.ts`** (line 193)

```typescript
// From:
aspectDiff * 0.5 +       // Relaxed: allow aspect flexibility

// To:
aspectDiff * 2.0 +       // Tighter: respect target shape
```

This makes the algorithm care 4x more about hitting the target aspect ratio. A 10% deviation now costs 0.2 (instead of 0.05), competing more fairly with uniformity.

---

## Also Fix: Remove Redundant Button & Verify Auto Default

### `src/pages/Index.tsx`

Wrap the Create/Regenerate button section to only show before first layout:

```tsx
{!state.layout && (
  <>
    <div className="flex justify-center">
      <Button ... onClick={handleCreateCollage}>
        <Wand2 /> Create Collage
      </Button>
    </div>
    {/* hint text */}
  </>
)}
```

---

## File Summary

| File | Change |
|------|--------|
| `src/lib/collageLayout.ts` | Line 193: `aspectDiff * 0.5` → `aspectDiff * 2.0` |
| `src/pages/Index.tsx` | Wrap button in `{!state.layout && (...)}` |

---

## Testing

After implementation:
1. Select "Square" → regenerate → verify aspect ratio is closer to 1.0
2. If still too loose, we can bump to `3.0` or `4.0`
3. Verify "Auto" shows as default in dropdown
4. Verify big button disappears after first collage creation

