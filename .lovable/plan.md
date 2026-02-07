

# Restore Smartcrop Count Display

## Design

### Completed State

```
PHOTOS (44) · 38 auto-cropped
         ↑       ↑
     total   smartcrop count
```

### Processing State

```
PHOTOS · 6 of 44 ready · 4 auto-cropped
                  ↑           ↑
          ready count   smartcrop count
```

The smartcrop count trails behind the ready count, showing real progress of both phases.

---

## Technical Changes

### File: `src/pages/Index.tsx`

**Lines 432-443**: Update the header text

```tsx
<h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
  {isProcessing ? (
    <>
      Photos
      <span className="mx-2 text-muted-foreground/50">·</span>
      <span className="text-emerald-600 normal-case tracking-normal">
        {state.photos.filter(p => !p.isProcessing && !p.error).length} of {state.photos.length} ready
      </span>
      {state.photos.filter(p => p.smartCrop !== null).length > 0 && (
        <>
          <span className="mx-2 text-muted-foreground/50">·</span>
          <span className="text-primary/80 normal-case tracking-normal">
            {state.photos.filter(p => p.smartCrop !== null).length} auto-cropped
          </span>
        </>
      )}
    </>
  ) : (
    <>
      Photos ({state.photos.length})
      {state.photos.filter(p => p.smartCrop !== null).length > 0 && (
        <>
          <span className="mx-2 text-muted-foreground/50 normal-case">·</span>
          <span className="text-primary/80 normal-case font-normal tracking-normal">
            {state.photos.filter(p => p.smartCrop !== null).length} auto-cropped
          </span>
        </>
      )}
    </>
  )}
</h3>
```

---

## Visual Examples

**During processing:**
```
PHOTOS · 6 of 44 ready · 4 auto-cropped    ▼
         └── green ───┘   └── purple ────┘
```

**After complete:**
```
PHOTOS (44) · 38 auto-cropped    ▼
```

**No smartcrops applied:**
```
PHOTOS (44)    ▼
```

---

## Summary

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add "auto-cropped" count to header in both processing and completed states |

