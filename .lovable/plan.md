
Goal
- Fix the “crop saved but thumbnail/preview shows the wrong crop” bug without piling on more remount/key hacks.
- Restore architectural simplicity: one correct, reusable crop-rendering implementation.

What’s actually happening (root cause)
- The “Smart Cropped” grid and Collage preview are updating (your last screenshot confirms a re-render occurs), but the crop math in `src/components/common/CroppedImage.tsx` is incorrect.
- The current implementation explicitly assumes a square container (“assuming square container for now”) and then uses a scale formula that ignores the image’s aspect ratio when computing the height scaling case.
- Concretely, for images where `originalWidth/originalHeight !== 1` (most photos), the code computes:
  - `scaleForHeight = 1 / (crop.height/originalHeight)`
  - But when the rendered `<img>` uses `height: auto` (preserving aspect ratio), the “height in container units” depends on `imageAR`. The correct scale for height must incorporate that.
- Result: after saving a manual crop (often tall/narrow), the component produces a transform that is “different” (so you see change) but wrong (so the crop looks incorrect).

Why the “key” fixes didn’t help
- Keys/remounting can address stale DOM/layout issues when props changes don’t lead to visible updates. Here, props are changing and you do see a change — it’s just the wrong crop due to wrong math.
- Adding keys increased complexity without addressing the actual failure mode.

Proposed fix (creative + simpler): render crops using SVG viewBox instead of custom transform math
- Replace the cropped rendering branch in `CroppedImage` with an SVG-based approach:
  - Set `viewBox` to the crop rectangle in original-image pixel coordinates.
  - Use `preserveAspectRatio` to get contain/cover semantics:
    - fit="contain"  -> `preserveAspectRatio="xMidYMid meet"`
    - fit="cover"    -> `preserveAspectRatio="xMidYMid slice"`
  - Render the full image inside the SVG at its original pixel dimensions:
    - `<image href={src} width={originalWidth} height={originalHeight} />`
- This eliminates the need to manually compute scale factors and translations, and it works for:
  - square thumbnails
  - arbitrary collage cell aspect ratios
  - any crop aspect ratio
  - any image aspect ratio

Implementation steps (code changes)
1) Refactor `src/components/common/CroppedImage.tsx`
   - Keep early returns for:
     - `!crop`
     - invalid crop (width/height too small)
     - missing `originalWidth/originalHeight` (defensive)
   - For the “cropped” case:
     - Render:
       - wrapper: `<div className="relative overflow-hidden w-full h-full ...">`
       - `<svg className="w-full h-full" viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`} preserveAspectRatio={...}>`
       - `<image href={src} x="0" y="0" width={originalWidth} height={originalHeight} />`
     - Ensure the SVG fills the container (`w-full h-full block`) so it behaves like the old `<img>` did.
   - Remove the internal `<img key={cropKey}>` approach for the cropped branch (no longer needed).
   - Optional cleanup: keep `cropKey` only if it’s still needed for the uncropped `<img>` branch; otherwise remove entirely to reduce complexity.

2) Remove the newly-added remount keys in callers (to reduce fragility)
   - `src/components/PhotoThumbnail.tsx`
     - Remove the `cropKey` computation and the `key={cropKey}` prop passed into `<CroppedImage />`.
   - `src/components/CollagePreview.tsx`
     - Remove the `cropKey` computation and the `key={cropKey}` prop passed into `<CroppedImage />`.
   - Rationale: once `CroppedImage` is correct and deterministic, remounting shouldn’t be necessary. Keeping keys everywhere is an architectural smell and can cause unintended side effects (losing internal state, unnecessary DOM churn).

3) Add a small targeted test (to prevent regression)
   - Create a new unit test (Vitest + RTL) for `CroppedImage`:
     - Case A: `crop=null` -> renders `<img>` with object-fit classes
     - Case B: `crop!=null` -> renders `<svg>` with:
       - correct `viewBox`
       - correct `preserveAspectRatio` for cover/contain
   - This won’t test browser rendering, but it will lock in the “no more transform math” contract and ensure we don’t accidentally revert.

Manual verification checklist (end-to-end)
- Repro the exact flow you showed:
  1) Upload one photo
  2) Observe “Smart Cropped” thumbnail
  3) Tap to adjust crop
  4) Make an extreme tall/narrow crop (like your screenshot)
  5) Save Crop
  6) Confirm:
     - Smart Cropped thumbnail shows exactly the expected region (centered appropriately)
     - Collage preview (if created) shows the same crop accurately
- Also test:
  - a wide crop
  - a near-full-image crop
  - contain vs cover usage (original grid should remain “contain”, smart cropped “cover”)

Risks / considerations
- SVG `<image href>` support is broadly good in modern browsers. Using object URLs should work.
- If any browser shows issues with `href`, we can switch to `xlinkHref` as a fallback (rarely needed in modern React, but easy to add if necessary).
- Performance should be fine for small grids; SVG here is lightweight and avoids continuous recalculation.

Outcome
- Crop rendering becomes correct and robust.
- Removes the need for repeated “key prop” fixes and reduces architectural fragility.
- `CroppedImage` becomes a genuinely reliable “single source of truth” for crop rendering across thumbnails and collage preview.
