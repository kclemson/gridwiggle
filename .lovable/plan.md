
# Update README "How It Works" Section

Expand the existing summary with a concise walkthrough of the algorithm flow, template system, and scoring approach. Keep it readable for non-contributors while giving enough detail to understand the architecture.

## Proposed Content

Replace the current two-paragraph "How It Works" section with:

**Paragraph 1** (keep existing summary, lightly edited)

**Paragraph 2 — Algorithm flow:**
1. Identify hero photo(s) by weight; separate remaining photos into content pool
2. Select candidate **templates** from a registry (corner-anchor, hero-column, hero-row, band variants, diagonal-corners for dual heroes) filtered by hero aspect ratio and canvas shape compatibility
3. For each template, sample combinations of **canvas aspect ratio** and **hero area fraction** (how much canvas area the hero occupies, typically 15-40%)
4. Compute hero rectangle geometry from those parameters, then decompose the remaining canvas into **packable regions** (e.g., corner-anchor produces a "beside" region and a "below" region)
5. Pack content photos into each region using **row-packing**: derive a target row count from photo count and mean aspect ratio, then fill rows so total height (or width) matches the region constraint
6. Score each candidate on **cell-area uniformity** (F-ratio across size tiers), **canvas AR deviation** from target, **hero prominence** (hero area vs. top content areas), and **hero coverage** ceiling
7. Select the best candidate (deterministic) or weighted-random among top scorers (shuffle mode)
8. Mirror the layout to a random corner for visual variety

**Paragraph 3** (keep existing worker note)

## Technical Details

- File changed: `README.md` lines 24-28
- No code changes, documentation only
