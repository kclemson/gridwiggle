

# Plan: Always Show Rejected Layouts with Shared Header Component

## What We're Building

When layout generation fails (even on the first attempt with no previous layout), we'll show the rejected layout visualization with red treatment instead of a dead-end error message. We'll also extract a shared header component to avoid duplication.

---

## Current User Experience

| Scenario | Current Behavior |
|----------|-----------------|
| First photos → generation fails | Error text: "Couldn't generate a layout" + Try Again button (dead end) |
| Had layout → shuffle fails | Previous layout + rejected overlay with red ring |

## New User Experience

| Scenario | New Behavior |
|----------|-------------|
| First photos → generation fails | Rejected layout with red ring + RejectionBadge + Try Again |
| Had layout → shuffle fails | Same as above (consistent) |

---

## Technical Changes

| File | Change |
|------|--------|
| `src/components/collage/CollageHeader.tsx` | **New file** - Shared header with shuffle/download buttons |
| `src/pages/Index.tsx` | Refactor to 3-way conditional + use shared header |

---

## 1. New Shared Header Component

Extract the header row with title + action icons to a reusable component:

```tsx
// src/components/collage/CollageHeader.tsx
interface CollageHeaderProps {
  onShuffle: () => void;
  onDownload?: () => void;
  isShuffling: boolean;
  isDownloading?: boolean;
  showDownload?: boolean;  // Hide for rejected layouts
}

export function CollageHeader({ 
  onShuffle, 
  onDownload, 
  isShuffling, 
  isDownloading,
  showDownload = true,
}: CollageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
        Collage
      </h3>
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8" 
          onClick={onShuffle}
          disabled={isShuffling}
          title="Shuffle layout"
        >
          <RefreshCw className={cn("h-4 w-4", isShuffling && "animate-spin")} />
        </Button>
        {showDownload && onDownload && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8" 
            onClick={onDownload}
            disabled={isDownloading}
            title="Download PNG"
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

## 2. Refactored Index.tsx Structure

Change from binary conditional to 3-way:

```text
BEFORE (lines 668-812):
├── !state.layout ?
│   └── layoutError ? <ErrorPrompt /> : null
└── state.layout exists
    ├── <Header />
    ├── <CollagePreview />
    ├── {layoutError && rejectedLayout && <RejectedOverlay />}
    └── <CollageSettings />

AFTER:
├── state.layout exists ?
│   ├── <CollageHeader showDownload />
│   ├── <CollagePreview />
│   ├── {isGenerating && <Spinner />}
│   └── <CollageSettings />
├── rejectedLayout exists ?
│   ├── <CollageHeader showDownload={false} />
│   ├── <RejectedPreview with red ring />
│   ├── <RejectionBadge />
│   └── <TryAgainButton />
└── layoutError ?
    └── <TextErrorFallback />  (only if no geometry)
```

---

## 3. Key Logic Changes in Index.tsx

### Remove nested rejected layout block

Currently the rejected layout is shown as an overlay when `layoutError && rejectedLayout` inside the `state.layout` branch. We'll move it to be a top-level condition.

### Three-way conditional (pseudo-code)

```tsx
{state.photos.length >= 2 && (
  <div className="relative">
    <div className="space-y-2 pt-4 border-t border-border">
      {state.layout ? (
        // SUCCESS: Valid layout
        <>
          <CollageHeader 
            onShuffle={handleCreateCollage}
            onDownload={handleExport}
            isShuffling={isGenerating}
            isDownloading={isExporting}
          />
          {exportError && <ExportError />}
          <div className="relative overflow-hidden">
            <CollagePreview layout={state.layout} ... />
            {isGenerating && <SpinnerOverlay />}
          </div>
          <CollageSettings ... />
        </>
      ) : rejectedLayout ? (
        // REJECTION: Show failed layout with diagnostics
        <>
          <CollageHeader 
            onShuffle={() => {
              setLayoutError(null);
              setRejectedLayout(null);
              regenerateCollage({ randomize: true });
            }}
            isShuffling={isGenerating}
            showDownload={false}  // Can't export rejected layout
          />
          <div className="relative">
            <div className="ring-4 ring-destructive rounded-lg overflow-hidden opacity-70">
              <CollagePreview
                photos={state.photos}
                layout={{
                  width: rejectedLayout.canvasWidth,
                  height: rejectedLayout.canvasHeight,
                  cells: rejectedLayout.cells,
                }}
                gapColor={state.settings.gapColor}
                onSwapPhotos={() => {}}  // Disabled
              />
            </div>
            <RejectionBadge reason={rejectedLayout.reason} details={rejectedLayout.details} />
            {isGenerating && <SpinnerOverlay />}
          </div>
          <CollageSettings ... />
        </>
      ) : layoutError ? (
        // FALLBACK: No geometry available
        <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{layoutError}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleCreateCollage}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      ) : null}
    </div>
    
    {/* Debug panel (unchanged) */}
    {import.meta.env.DEV && <DebugPanel ... />}
  </div>
)}
```

---

## 4. Behavior Notes

| Feature | Success | Rejection | Error Fallback |
|---------|---------|-----------|----------------|
| Download button | ✅ | ❌ Hidden | N/A |
| Shuffle button | ✅ | ✅ | ❌ (Try Again) |
| Drag/swap photos | ✅ | ❌ Disabled | N/A |
| CollageSettings | ✅ | ✅ | ❌ |
| RejectionBadge | ❌ | ✅ | ❌ |
| Red ring | ❌ | ✅ | N/A |

---

## Files to Create/Modify

1. **Create** `src/components/collage/CollageHeader.tsx`
2. **Modify** `src/pages/Index.tsx`:
   - Import `CollageHeader`
   - Replace inline header with component
   - Restructure 3-way conditional
   - Remove nested rejected layout block

