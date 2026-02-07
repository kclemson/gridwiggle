

# Fix Black Background on Collapsible Headers and Empty Uploader

## Problem
Several UI elements show near-black backgrounds that clash with the charcoal app background (HSL 240, 8%, 18%):

1. **Empty state uploader** (`PhotoUploader.tsx`): Uses `bg-surface` (HSL 240, 8%, 8%)
2. **Collapsible header rows**: The Photos, Configure, and V3 Tuning headers appear darker than the surrounding UI

---

## Root Cause

The `--surface` CSS variable is intentionally darker than the app background (8% vs 18% lightness), creating a visible black rectangle. The collapsible triggers don't have explicit backgrounds but may be inheriting or the `hover:bg-muted/50` is creating visual inconsistency.

---

## Technical Changes

### 1. File: `src/components/PhotoUploader.tsx`

**Line 94**: Replace the opaque surface background with transparent

```tsx
// Before:
className="... bg-surface hover:bg-surface-elevated hover:border-primary/50 ..."

// After:
className="... bg-transparent hover:bg-muted/30 hover:border-primary/50 ..."
```

The dashed border provides sufficient visual definition for the upload zone.

---

### 2. File: `src/pages/Index.tsx`

**Line 408**: Ensure the Photos collapsible trigger has no background that could appear dark

```tsx
// Current (should be fine, but verify):
<button className="flex items-center justify-between w-full px-1 py-2 text-left hover:bg-muted/50 rounded-lg transition-colors">

// This is transparent by default - no change needed unless testing reveals an issue
```

---

### 3. File: `src/components/CollageSettings.tsx`

**Line 38**: Already uses only `hover:bg-muted/50` with no base background - should be transparent

---

### 4. File: `src/components/V3TuningSection.tsx`

**Line 57**: Already uses only `hover:bg-muted/50` with no base background - should be transparent

---

## Summary

The main change is in `PhotoUploader.tsx` where `bg-surface` explicitly sets a near-black background. The collapsible triggers are already transparent - if they still appear dark after the PhotoUploader fix, the issue may be elsewhere (parent containers or other styling).

| File | Change |
|------|--------|
| `src/components/PhotoUploader.tsx` | Replace `bg-surface hover:bg-surface-elevated` with `bg-transparent hover:bg-muted/30` |

---

## Result
- Empty uploader shows charcoal background with dashed border (no black fill)
- All collapsible headers blend seamlessly with the app background
- Hover states use subtle muted overlay instead of darker surface colors

