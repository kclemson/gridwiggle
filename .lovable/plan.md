

# Fix Crop Editor Footer: Single-Row Layout on Mobile

## Problem
`DialogFooter` applies `flex-col-reverse` on mobile, stacking all controls vertically. The custom `flex-col sm:flex-row` class on line 367 conflicts with this, creating a messy layout.

## Solution
Replace `DialogFooter` with a plain `div` that's always a horizontal flex row. To fit everything on ~343px (375px minus padding), use icon-only buttons for Delete and Smart Crop on mobile, with text labels only on larger screens.

## Layout (all screen sizes, single row)
`[Trash icon] [Sparkles icon] ---- [Hero toggle] [Cancel] [Save]`

On desktop (sm+), the icons get their text labels back:
`[Trash Delete Photo] [Sparkles Smart Crop] ---- [Hero toggle] [Cancel] [Save]`

## Technical Details

### File: `src/components/CropEditor.tsx` (lines 367-404)

Replace `DialogFooter` with:

```tsx
<div className="px-4 py-3 border-t border-border shrink-0 flex items-center gap-2">
  <Button 
    variant="ghost" 
    size="icon"
    onClick={handleDelete}
    className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:w-auto sm:px-3"
  >
    <Trash2 className="h-4 w-4" />
    <span className="hidden sm:inline ml-1.5">Delete</span>
  </Button>
  {photo.smartCrop && (
    <Button 
      variant="ghost" 
      size="icon"
      onClick={handleApplySmartCrop}
      disabled={isSmartCropActive}
      className="sm:w-auto sm:px-3"
    >
      <Sparkles className="h-4 w-4" />
      <span className="hidden sm:inline ml-1.5">Smart Crop</span>
    </Button>
  )}
  <div className="flex items-center gap-2 ml-auto">
    <Switch id="hero-toggle" checked={isHero} onCheckedChange={setIsHero} />
    <Label htmlFor="hero-toggle" className="text-sm">Hero</Label>
  </div>
  <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
  <Button size="sm" onClick={handleSave} disabled={!hasChanges}>Save</Button>
</div>
```

Key changes:
- Plain `div` instead of `DialogFooter` -- no conflicting flex-col-reverse
- Delete and Smart Crop are `size="icon"` on mobile, expand with text on `sm+`
- Cancel/Save use `size="sm"` to save space
- `ml-auto` on the Hero toggle group pushes it and the action buttons to the right
- Single row on all screen sizes

