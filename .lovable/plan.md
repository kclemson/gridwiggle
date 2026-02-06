
## What you’re seeing (why V3 “still not finding anything”)

The new “content cell cap” check is working exactly as designed: it rejects any proposal where a non-hero photo ends up too large relative to the hero.

Your screenshot shows:

- `heroArea: 46487`
- `maxContentArea: 35759` (because `maxContentArea = heroArea / hero_minProminence` and `hero_minProminence = 1.3`)
- `largestContentArea: 57498` (and other runs `63841`, `40019`, etc.)

So every proposal is getting rejected before the prominence check, and V3 returns `null` (“No valid configuration found”).

The important part: **this isn’t just “bad luck”; it exposes a structural issue in V3’s current packing + distribution.** The engine is producing oversized supporting cells, and the cap simply makes that visible.

---

## Root causes (in current code)

### 1) Region distribution is naive (and uses misleading “area”)
`distributePhotos` in `src/lib/v3/entities/content-pool.ts` assigns photos by `region.width * region.height`.

But in corner decomposition (`src/lib/v3/entities/canvas.ts`), the BELOW region height is a **placeholder** (`tuning.region_minHeight`) even though that region is conceptually “unbounded” (it grows as needed). That means:

- BELOW gets under-allocated relative to how much width it has (480px)
- BESIDE can get over-allocated relative to its limited vertical span (hero height)

Under-allocating wide regions is the fastest way to get **rows with too few photos**, which yields **very tall rows** and **giant cell areas**.

### 2) Row packing can create “bad row cardinalities” (e.g., singleton or 2-photo wide rows)
`packPhotosIntoRegion` → `distributeToRows` chunks sequentially. This can easily create:
- a last row with 1 photo, or
- multiple rows with only 2 photos in a very wide region

Those cases blow up cell areas (exactly the kind of 57k–63k areas you’re seeing at 480px width).

### 3) The packer ignores region height (overlap risk)
BESIDE has a finite height (hero height), but `packPhotosIntoRegion` never tries to keep `actualHeight <= region.height`.
So even if we “make it pass” with more photos in BESIDE, we could silently create overlap with the BELOW region.

Right now you’re “saved” only because BESIDE is usually under-packed or because the overlap isn’t being validated.

---

## The decision: what we should do next

Keep the cap (it’s a correct constraint), but make the system **cap-aware** and **height-aware** so it can actually find valid solutions.

The next step is not “more logging”; it’s **teaching the packer and distributor to avoid producing invalid geometry**.

---

## Implementation approach (target outcome)

For typical inputs like your 19-photo / 480px canvas example, V3 should:
1. Allocate photos so that wide/unbounded regions get enough photos to avoid huge cells.
2. Pack each region so that:
   - no cell exceeds `maxContentArea`, and
   - finite-height regions (BESIDE) don’t exceed their height budget.

If it can’t satisfy those constraints, it should still return `null` (consistent with the “no silent fallback” philosophy), but it should succeed far more often on common sets.

---

## Planned changes (files + concrete steps)

### A) Make row packing “constraint-aware”
**File:** `src/lib/v3/row-pack.ts`

1) **Change row distribution to round-robin** (prevents singleton last rows)
- Replace the current “chunk by ceil(n/r)” approach with:
  - `rows[i % rowCount].push(photo)`
This yields row sizes like `3,2,2` instead of `3,3,1`.

2) **Add an optional constraints parameter** to `packPhotosIntoRegion`, e.g.
- `maxCellArea?: number`
- `maxHeight?: number` (used when region.height is finite)

3) **Iteratively adjust rowCount downward** (never below `minRows` from `region_minWidth`) until constraints are met:
- Start with current `calculateOptimalRowCount`
- Pack → compute:
  - `maxAreaSeen` from cells
  - `actualHeight`
- If `maxCellArea` violated OR `maxHeight` violated:
  - decrement `rowCount` and repack
- Stop once constraints satisfied or `rowCount === minRows`

Why downward only: fewer rows ⇒ more photos per row ⇒ lower row height ⇒ smaller cell area and smaller total height.

Expected effect: wide regions will avoid “2-photo rows” that create huge areas.

---

### B) Fix region decomposition semantics for BELOW (unbounded)
**File:** `src/lib/v3/entities/canvas.ts`

- Change BELOW region height from `tuning.region_minHeight` placeholder to `Infinity`.
- Keep BESIDE region height as the hero height.

This makes it explicit which region is height-bounded and which is not.

---

### C) Make region packing pass the constraints through
**File:** `src/lib/v3/entities/content-pool.ts`

Update `packAllRegions` so it can pass constraints into `packPhotosIntoRegion`:

- Add a new parameter: `maxCellArea?: number`
- For each region:
  - `maxHeight = Number.isFinite(region.height) ? region.height : undefined`
  - call `packPhotosIntoRegion(regionPhotos, region, gap, tuning, { maxCellArea, maxHeight })`

Also: return optional “per-region diagnostics” (max cell area per region, used rowCount, actualHeight) so intersection can log which region was the bottleneck.

---

### D) Make distribution stop starving the wide/unbounded region
**File:** `src/lib/v3/entities/content-pool.ts` (and update call site)

Right now distribution uses bogus area math because BELOW height is not meaningful.

Replace the area-proportional algorithm with a **constraint-driven split** when there are exactly 2 regions (corner fallback path):

- Identify:
  - `besideRegion` (finite height)
  - `belowRegion` (Infinity height)
- Given `maxCellArea`:
  - Search a small set of candidate splits (counts) of photos assigned to BESIDE vs BELOW.
  - For each split:
    - pack BESIDE with `maxHeight = heroHeight` and `maxCellArea`
    - pack BELOW with `maxCellArea`
    - accept only splits where BESIDE fits its height
    - score split by minimizing `max(maxAreaBeside, maxAreaBelow)` (and optionally height utilization)
  - Choose best split and return assignments.

Photo selection heuristic for splits:
- Prefer putting higher aspect ratio (wider) photos into BELOW first (because BELOW can host denser rows more easily, lowering height and area).

This directly addresses the failure mode you’re seeing: too few photos in a wide region → huge cells.

---

### E) Wire it up in intersection
**File:** `src/lib/v3/intersection.ts`

- Move `heroArea` / `maxContentArea` computation earlier (before distribution).
- Call the new distribution function (or updated `distributePhotos`) with enough context to be cap-aware (at minimum: `maxCellArea`, regions, tuning, gap).
- Call `packAllRegions(..., maxContentArea)` so each region packing is also cap-aware.
- Keep the existing global cap check as a final guard (it should almost never trigger once the packer is enforcing the same constraint).

Add improved logs:
- chosen split: `{ besideCount, belowCount }`
- per-region packing summary:
  - `usedRowCount`, `actualHeight`, `maxAreaSeen`
This will let you see exactly why a proposal failed: “BESIDE can’t fit height” vs “BELOW can’t get under cap without violating minWidth”.

---

## Acceptance criteria (what “fixed” looks like)

1) With your current dataset (19 photos, 480px canvas, 1 hero), V3 should frequently produce a layout instead of `null`.
2) The logs should show:
   - A chosen split (not just rejections)
   - No “content cell exceeds cap” rejections in normal cases
3) No region overlap:
   - BESIDE packed `actualHeight` must be <= heroHeight
4) The hero-to-runner-up ratio should be >= `hero_minProminence` (1.3) when a layout is returned.

---

## Risks / tradeoffs

- In some extreme AR distributions, constraints may still be unsatisfiable (that’s okay; V3 should return `null` rather than weaken constraints silently).
- Adding constraint-aware packing introduces more computation, but for photo counts in the tens it should be fine.
- This is a meaningful step toward the “negotiation” model: constraints are now applied during allocation/packing, not only as post-hoc rejection.

---

## Files we will modify

- `src/lib/v3/row-pack.ts` (constraint-aware packing + round-robin distribution)
- `src/lib/v3/entities/canvas.ts` (BELOW height = Infinity)
- `src/lib/v3/entities/content-pool.ts` (cap-aware packAllRegions + constraint-driven distribution for 2-region case)
- `src/lib/v3/intersection.ts` (compute cap earlier + call the cap-aware distribution/packing + richer logs)

