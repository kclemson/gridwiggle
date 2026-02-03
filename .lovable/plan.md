
# Fix Crop Editor - Remove Unnecessary useEffect

The current approach uses useEffect to read container dimensions after mount, causing a flash of 0x0 dimensions. This is backwards - we should let the browser do what it's good at (layout) and only read dimensions when needed.

---

## Solution

Use CSS to naturally size the image (`max-width: 100%`, `max-height: 100%`, `object-fit: contain`), then read the **actual rendered image dimensions** via the image's `onLoad` event or a ref callback. The image element itself knows its rendered size.

---

## File Changes

### `src/components/CropEditor.tsx`

**Remove:**
- `imageDimensions` state (replaced with computed values)
- The useEffect that reads container dimensions
- The resize event listener

**Add:**
- `imageRef` to reference the actual `<img>` element
- A helper function that reads the image's rendered dimensions when needed (via `imageRef.current.getBoundingClientRect()`)
- `onLoad` handler on the image to trigger initial calculation

**Key insight:** The image's `naturalWidth`/`naturalHeight` and `getBoundingClientRect()` give us everything we need - the original dimensions and the rendered dimensions - without managing state that duplicates what the browser already knows.

---

## New Approach

```text
┌─────────────────────────────────────────┐
│            Container (flex-1)           │
│  ┌───────────────────────────────────┐  │
│  │  <img>                            │  │
│  │  max-w-full max-h-full            │  │
│  │  object-fit: contain              │  │
│  │                                   │  │
│  │  Browser handles sizing ───────────► scale = renderedWidth / naturalWidth
│  │                                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**On image load:** Read `imageRef.current.width` / `imageRef.current.naturalWidth` to get the scale factor.

**On resize:** Only needed if window resize support is required - can use ResizeObserver on the image element itself.

---

## Benefits

| Before | After |
|--------|-------|
| useEffect runs after paint → black flash | Image visible immediately |
| Managing `imageDimensions` state | Browser handles layout |
| Reading container size to calculate image size | Reading actual image size directly |
| Complex state synchronization | Simple computed values |

---

## Implementation Details

1. Add `imageRef` to the component
2. Remove `imageDimensions` state entirely
3. Change image to use CSS-based sizing: `className="max-w-full max-h-full object-contain"`
4. Compute `scale` on demand from `imageRef.current.width / photo.originalWidth`
5. For resize handling: Use ResizeObserver on the image element (or just recalculate on pointer events since that's when we actually need accurate values)
