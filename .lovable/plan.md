

## Remove "Create Collage" Button

### Rationale

Since the collage now auto-generates after processing completes, and there's a refresh icon in the collage header for regeneration, the "Create Collage" button is redundant.

---

## Technical Changes

### File: `src/pages/Index.tsx`

**1. Remove computed values (lines 240-242)**

These are only used by the button:
```tsx
// DELETE these lines:
const photosWithSmartCrop = state.photos.filter((p) => p.smartCrop || p.manualCrop);
const canCreateCollage = photosWithSmartCrop.length >= 2 && !isProcessing;
```

**2. Remove button section (lines 328-353)**

Delete the entire conditional block:
```tsx
// DELETE this entire section:
{/* Create collage button - only show before first creation */}
{!state.layout && (
  <>
    <div className="flex justify-center">
      <Button
        size="default"
        className="gap-2"
        disabled={!canCreateCollage}
        onClick={handleCreateCollage}
      >
        <Wand2 className="h-5 w-5" />
        Create Collage
        {isProcessing && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
      </Button>
    </div>

    {!canCreateCollage && state.photos.length > 0 && (
      <p className="text-center text-sm text-muted-foreground">
        {isProcessing 
          ? 'Please wait while AI analyzes your photos...'
          : 'Add at least 2 photos to create a collage'
        }
      </p>
    )}
  </>
)}
```

---

## Result

- Cleaner UI: no redundant button
- Photos upload → processing shows in PhotoGrid → collage auto-generates → refresh icon available for regeneration
- Removed ~20 lines of code

