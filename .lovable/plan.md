
## What’s happening (based on the screenshots + code)

### 1) Smart-cropped thumbnails not reflecting your saved crop
Your saved crop is actually being persisted correctly (you can see it when you reopen the editor). The reason the thumbnail still shows both people is the thumbnail renderer is currently using `fit="contain"` even when a crop exists.

With a narrow crop (one person), **“contain” tries to fit the entire crop inside the square thumbnail**, which inevitably reveals extra image content to fill the leftover space. That makes it look like your crop “didn’t apply”, even though it did.

This is consistent with:
- The crop editor showing the correct crop
- The thumbnail still showing more content than the crop
- The collage preview (which uses `fit="cover"`) generally looking correct

### 2) Layout algorithm making 2 photos huge with ~13 photos
The current layout generator switches to a greedy row split for `n > 6` and caps landscape at effectively ~3 rows. It can produce rows with 1–2 photos, which makes those cells enormous because row height is computed as `availableWidth / rowAspectSum`.

So with 13 photos, it’s easy for the greedy splitter to accidentally create one or two “short” rows (few photos), and those become huge.

You also want an architecture that can later support “hero” photos—so we should design the scoring/layout API with weights in mind now, even if we don’t expose UI for it yet.

---

## Changes I will implement

### A) Make smart-cropped thumbnails respect the crop visually
**File:** `src/components/PhotoThumbnail.tsx`

**Change:**
- When `showCropped` is true and `activeCrop` exists, render with `fit="cover"` instead of `contain`.

**Implementation detail:**
- Compute a fit mode:
  - `cover` when we are showing a crop (`showCropped && activeCrop`)
  - otherwise `contain` (original photos or when crop is missing/invalid)

**Why this fixes it:**
- `cover` makes the crop region fill the square thumbnail, which prevents any outside-the-crop content from appearing in the thumbnail.

---

### B) Improve collage layout so photos default to similar sizes (especially for 10–20 photos)
**File:** `src/lib/collageLayout.ts`

#### B1) Remove/stop using the current greedy row splitter
- The greedy logic is the primary reason you can get 1–2 photos in a row, creating “giant” cells.

#### B2) Replace “best split” selection with a scored optimization that prefers uniform cell areas
We’ll evaluate candidate row partitions and pick the one with the best score using metrics that align with your goal:

**Metrics to score a candidate partition**
- **Area uniformity (primary):** coefficient of variation (CV) of per-cell areas  
  - Compute approximate cell sizes at a reference width (e.g., 1200):
    - `rowHeight = baseWidth / sum(aspectRatiosInRow)`
    - `cellWidth = (aspectRatio / sumAR) * baseWidth`
    - `cellArea = cellWidth * rowHeight`
  - Penalize high variance so we avoid “two huge + many tiny”
- **Row height uniformity (secondary):** CV of row heights
- **Row balance constraints:** penalize very short/very long rows
- **Overall collage aspect guidance (light):** keep result near target aspect (landscape ~1.5, portrait ~0.75), but not at the cost of horrible sizing

#### B3) Better row-count heuristics for larger sets
Instead of hard-capping rows at ~3 in landscape, we’ll choose a reasonable range:
- Compute an **ideal photos-per-row** (landscape ~4, portrait ~3 as a starting point)
- Derive **ideal row count**: `rows ≈ ceil(n / idealPhotosPerRow)`
- Evaluate partitions in a small neighborhood: e.g. `rows-1, rows, rows+1` (clamped to sane limits)

This ensures 13 photos will tend toward ~4 rows rather than 2–3, preventing oversized rows.

#### B4) Prepare for “hero photos” with a parameterized weighting approach
Without adding UI yet, I’ll refactor layout generation to accept an optional `options` object, e.g.:

- `generateCollageLayout(photos, settings, options?)`
- `options.photoWeights?: Record<photoId, number>` (default 1)

**How weights will influence layout (forward-compatible):**
- Use a **weighted effective aspect** for width distribution and row scoring:
  - `effectiveAspect = clamp(aspectRatio, minAR, maxAR) * weight`
- This makes “hero” photos naturally larger in the layout when you later set weight > 1.

This keeps the architecture resilient: adding the hero selection UI later becomes a small feature on top, not a redesign.

---

## Validation / How we’ll test

### Thumbnail crop behavior
1. Upload a photo with multiple people.
2. Wait for smart crop.
3. Tap the thumbnail, adjust crop to one person, Save.
4. Confirm the thumbnail now visually reflects the crop (only one person visible).

### Layout uniformity with ~13 photos
1. Upload ~13 mixed photos.
2. Create collage.
3. Confirm:
   - No rows with only 1–2 photos (unless n is very small)
   - Cell sizes are broadly similar (no “two huge, rest tiny”)
4. Try portrait orientation as well.

### Regression checks
- Small sets (2–6 photos) should still produce nice-looking layouts.
- Drag-to-swap should still work (layout only changes when regenerating).

---

## Notes / Known related issue (not part of this plan, but important)
Your console logs show `QuotaExceededError` from `localStorage` persistence when you have many photos (base64 data URLs are large). This doesn’t directly cause the crop-thumbnail mismatch, but it will cause persistence issues and can produce confusing behavior after refresh.

If you want, next we can move persistence to a storage approach that supports larger payloads (or store images in backend storage and only keep lightweight references locally).

---

## Files that will change
- `src/components/PhotoThumbnail.tsx` (thumbnail should use `cover` when showing a crop)
- `src/lib/collageLayout.ts` (new scoring-based row partitioning; add optional weights for future “hero” support)
- (Optional) `src/test/*` add a small unit test around layout scoring to prevent regressions (e.g., ensure no extreme area ratios for n=13 in a representative synthetic set)
