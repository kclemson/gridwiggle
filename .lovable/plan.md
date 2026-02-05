

# Replace Em-Dash with Parentheses for Helper Text

## Changes

### 1. PhotoGrid.tsx - Use parentheses for hint
**File:** `src/components/PhotoGrid.tsx` (lines 39-44)

```typescript
// Change from:
<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
  {title} ({photos.length})
  {hint && (
    <span className="normal-case font-normal italic ml-1">— {hint}</span>
  )}
</h3>

// Change to:
<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
  {title} ({photos.length})
  {hint && (
    <span className="normal-case font-normal italic ml-1">({hint})</span>
  )}
</h3>
```

### 2. Index.tsx - Remove em-dash from collage hint
**File:** `src/pages/Index.tsx` (line 391)

```typescript
// Change from:
<span className="text-xs text-muted-foreground font-normal italic">
  — Drag to rearrange • Tap ★ to feature
</span>

// Change to:
<span className="text-xs text-muted-foreground font-normal italic">
  Drag to rearrange • Tap ★ to feature
</span>
```

## Visual Result

**Before:**
```
PHOTOS (21) — tap to adjust crop
COLLAGE     — Drag to rearrange • Tap ★ to feature
```

**After:**
```
PHOTOS (21) (tap to adjust crop)
COLLAGE     Drag to rearrange • Tap ★ to feature
```

## Files to Modify

| File | Change |
|------|--------|
| `src/components/PhotoGrid.tsx` | Replace `— {hint}` with `({hint})` |
| `src/pages/Index.tsx` | Remove `— ` prefix from collage hint |

