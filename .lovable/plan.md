

## Style the Collage Header Hint Text

Match the "Drag to rearrange • Tap ★ to feature" text styling to the "tap to crop" hint styling.

---

## Current vs Target Styling

| Element | Current | Target |
|---------|---------|--------|
| "tap to crop" | `normal-case font-normal italic` with em-dash | ✓ |
| "Drag to rearrange..." | `text-sm text-muted-foreground` (no italic, no em-dash) | Needs update |

---

## File Change

### `src/pages/Index.tsx` (lines 350-352)

**From:**
```tsx
<p className="text-sm text-muted-foreground">
  Drag to rearrange • Tap ★ to feature
</p>
```

**To:**
```tsx
<span className="text-xs text-muted-foreground font-normal italic">
  — Drag to rearrange • Tap ★ to feature
</span>
```

Changes:
- `text-sm` → `text-xs` (match the header size)
- Add `font-normal italic` (match "tap to crop" style)
- Add em-dash prefix `—` (match "tap to crop" pattern)
- Change from `<p>` to `<span>` (inline with flex layout)

