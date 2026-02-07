

# Reduce Perceived Lag During Collage Generation

## What's Causing the "Laggy" Feel

The layout algorithm itself is fast (~10-50ms of pure math), but the UX feels laggy because:

1. **No feedback when regenerating** - Clicking shuffle or adjusting settings provides no visual indication that work is happening
2. **Sudden appearance** - The collage just "pops" in without any transition
3. **No skeleton/placeholder** - While generating, the space is either empty or shows the old layout

## What Changes For You

After this implementation:
- **Spinner on refresh button** while generating
- **Subtle fade transition** when the layout changes (old → new)
- **Skeleton placeholder** when generating from empty (first collage or after clearing)
- **Immediate button feedback** - the shuffle icon spins while generating

---

## Technical Plan

### 1. Add Generating State to Index.tsx

Track when the layout is actively being computed:

```typescript
const [isGenerating, setIsGenerating] = useState(false);

// In regenerateCollage:
const regenerateCollage = useCallback((options: RegenerateOptions = {}) => {
  setIsGenerating(true);
  
  // Use setTimeout(0) to let React paint the loading state before blocking
  setTimeout(() => {
    try {
      // ... existing generation logic ...
    } finally {
      setIsGenerating(false);
    }
  }, 0);
}, [...]);
```

### 2. Update Shuffle Button to Show Spinner

In the collage header area, show a spinner when generating:

```typescript
<Button 
  variant="ghost" 
  size="icon" 
  className="h-8 w-8" 
  onClick={handleCreateCollage}
  disabled={isGenerating}
  title="Shuffle layout"
>
  <RefreshCw className={cn("h-4 w-4", isGenerating && "animate-spin")} />
</Button>
```

### 3. Add Fade Transition to CollagePreview

Wrap the collage in a transition that fades between old and new layouts:

```typescript
// In CollagePreview.tsx - add transition on the container
<div
  ref={collageRef}
  className="relative mx-auto transition-opacity duration-200"
  style={{
    opacity: isTransitioning ? 0.5 : 1,
    // ... existing styles
  }}
>
```

Or simpler approach - use CSS `transition` on the parent in Index.tsx:

```typescript
<div className={cn(
  "relative overflow-hidden transition-opacity duration-150",
  isGenerating && "opacity-60"
)}>
  <CollagePreview ... />
</div>
```

### 4. Add Skeleton Placeholder for First Generation

When there's no layout yet but we're generating:

```typescript
{!state.layout && isGenerating && (
  <div className="aspect-[4/3] bg-muted rounded-xl animate-pulse flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
)}
```

### 5. Also Update Carousel Refresh Button

The new refresh button in the carousel should also show feedback:

```typescript
// In PhotoCarousel.tsx
<Button
  variant="outline"
  size="sm"
  onClick={onRefresh}
  disabled={isRefreshing}  // New prop
  title="Regenerate collage"
>
  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
</Button>
```

Pass `isGenerating` down as `isRefreshing` prop.

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `isGenerating` state, wrap generation in setTimeout, pass to children |
| `src/components/PhotoCarousel.tsx` | Add `isRefreshing` prop, show spinner when true |
| Collage section in Index.tsx | Add opacity transition and skeleton placeholder |

## Why setTimeout(0)?

The layout generation is synchronous and blocks the main thread for ~10-50ms. Without `setTimeout(0)`, React can't paint the "generating" state before the blocking work starts. The tiny delay allows the spinner/opacity change to render first, giving users immediate visual feedback.

## Alternative: Web Worker

If we want truly non-blocking generation, we could move the layout algorithm to a Web Worker. However, for ~10-50ms of work, `setTimeout(0)` is sufficient and much simpler.

