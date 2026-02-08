

# Fix: Stable Refresh Button Position During Error State

## Problem

When the collage is in an error/rejection state, the download button disappears completely from the DOM. This causes the refresh button to shift position (moves right to where the download button was), creating jarring visual instability.

## Solution

Instead of conditionally rendering the download button, always render it but make it **invisible and disabled** when `showDownload={false}`. This preserves the layout spacing while hiding it from users.

## Technical Change

**`src/components/collage/CollageHeader.tsx`**

Current approach (removes button from DOM):
```tsx
{showDownload && onDownload && (
  <Button ...>
    <Download />
  </Button>
)}
```

New approach (always in DOM, visually hidden when disabled):
```tsx
<Button 
  variant="ghost" 
  size="icon" 
  className={cn(
    "h-8 w-8",
    !showDownload && "invisible"  // Takes up space but hidden
  )}
  onClick={onDownload}
  disabled={isDownloading || !showDownload}
  title="Download PNG"
>
  {isDownloading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <Download className="h-4 w-4" />
  )}
</Button>
```

The `invisible` class (Tailwind) sets `visibility: hidden`, which:
- Keeps the element in the layout flow (preserves spacing)
- Hides it visually
- Makes it non-interactive

## Files to Modify

| File | Change |
|------|--------|
| `src/components/collage/CollageHeader.tsx` | Replace conditional render with `invisible` class |

