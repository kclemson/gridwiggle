

## Multi-Hero Layout with Coexisting Drag-and-Drop

Add hero toggle directly in the collage preview while preserving all existing interactions (mouse drag, touch drag, cell click for crop editor).

### Interaction Design

The key insight is that the **star button is a separate element** that intercepts its own events:

```text
┌─────────────────────────────┐
│ ┌─────┐                     │  Star button: separate click target
│ │ ★   │                     │  - e.stopPropagation() prevents cell click
│ └─────┘                     │  - Not draggable, doesn't trigger drag
│                             │
│     Photo cell              │  Cell: handles drag + click
│     (draggable)             │  - Drag: mouse/touch + movement
│                             │  - Click: opens crop editor
└─────────────────────────────┘
```

**Event flow:**
- Click on star button → `e.stopPropagation()` → only toggles hero
- Click elsewhere on cell → bubbles to cell → opens crop editor  
- Drag on cell (including over star) → cell's drag handlers take over

### Implementation Details

**Star Button Placement**

```typescript
<div className="absolute top-2 right-2 z-10">
  <button
    className="p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
    onClick={(e) => {
      e.stopPropagation();  // Prevent cell click (crop editor)
      onToggleHero(photo.id);
    }}
    onMouseDown={(e) => e.stopPropagation()}  // Prevent drag initiation
    onTouchStart={(e) => e.stopPropagation()} // Prevent touch drag
    draggable={false}  // Explicitly not draggable
  >
    {photo.priority === 1 ? <Star filled /> : <Star outline />}
  </button>
</div>
```

**Key event handling:**
- `onClick` with `stopPropagation()` - toggles hero, doesn't open crop editor
- `onMouseDown` with `stopPropagation()` - prevents the cell from thinking a drag started
- `onTouchStart` with `stopPropagation()` - prevents touch drag initiation
- `draggable={false}` - explicit safety

**Touch considerations:**
On mobile, we need to distinguish between:
1. Tap on star → toggle hero
2. Tap elsewhere → open crop editor  
3. Touch + hold/move → drag to swap

The star button handles its own touch events independently. The cell's touch drag only initiates when touch starts outside the star.

### Visual States

| State | Star Appearance | Cell Appearance |
|-------|-----------------|-----------------|
| Standard photo | Outline star (muted) | Normal |
| Hero photo | Filled star (gold/yellow) | Subtle glow or badge |
| Hover over cell | Star becomes more visible | - |
| Dragging | Star hidden or dimmed | Opacity reduced, scale down |
| Drop target | - | Ring highlight (existing) |

**Showing/hiding the star:**
- Always visible but subtle (semi-transparent background)
- More prominent on hover
- Hidden during active drag to avoid visual clutter

```typescript
const showStar = !isBeingDragged; // Hide star when dragging this cell
```

### Complete Cell Render

```typescript
<div
  key={cell.photoId}
  data-photo-id={photo.id}
  className={cn(
    "absolute overflow-hidden cursor-grab active:cursor-grabbing transition-all group",
    isBeingDragged && "opacity-50 scale-95",
    isDragTarget && "ring-4 ring-primary ring-offset-2 ring-offset-background"
  )}
  style={{...}}
  draggable
  onDragStart={(e) => handleDragStart(e, photo.id)}
  // ... other drag handlers
  onClick={() => onCellClick?.(photo.id)}
>
  <CroppedImage ... />
  
  {/* Hero toggle button - appears on hover, always accessible */}
  {!isBeingDragged && (
    <button
      className={cn(
        "absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all",
        "bg-black/40 hover:bg-black/60",
        "opacity-0 group-hover:opacity-100",  // Fade in on hover
        "md:opacity-70"  // More visible on desktop
      )}
      onClick={(e) => {
        e.stopPropagation();
        onToggleHero?.(photo.id);
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      draggable={false}
    >
      <Star 
        className={cn(
          "h-4 w-4",
          photo.priority === 1 ? "fill-yellow-400 text-yellow-400" : "text-white"
        )} 
      />
    </button>
  )}
</div>
```

### Mobile Touch Handling

Current touch flow:
1. `onTouchStart` on cell → sets `touchDragId`, records position
2. `onTouchMove` on container → updates position (shows drag preview)
3. `onTouchEnd` on container → finds target cell, swaps if different

With star button:
1. `onTouchStart` on star → `stopPropagation()` → doesn't set `touchDragId`
2. `onTouchEnd` on star → toggles hero (handled by button's onClick)

The cell's touch drag only activates when touch starts on the photo itself, not the star.

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/CollagePreview.tsx` | Add star button overlay, `onToggleHero` prop, event isolation |
| `src/pages/Index.tsx` | Add `handleToggleHero`, pass to CollagePreview |
| `src/lib/collageLayout.ts` | Multi-strategy hero layout algorithm |

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Click star while dragging | Not possible - star hidden during drag |
| Touch star then drag | Star handles touch, drag never initiates |
| Fast tap anywhere | Click fires, not drag |
| Long press on star | Still just toggles (no drag) |
| Drag starting from star area | Stopped by star's `onMouseDown`/`onTouchStart` |

### Hint Text Update

Current hint: "Drag photos to rearrange • Tap to adjust crop"

New hint: "Drag to rearrange • Tap ★ for hero • Tap photo to adjust crop"

