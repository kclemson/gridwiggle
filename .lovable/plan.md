

# Add Dev Tools Section to README

## What changes

Add a new section to `README.md` documenting the three dev-only test tools, what they do, and when to use them.

## Content to add

After the existing "Development" section (which already mentions the routes), add a **Dev Tools** subsection with descriptions of each tool:

### `/layout-test` -- Layout Test
Rapid iteration workbench for the layout algorithm. Generates synthetic photo sets (CSS rectangles, no real images) with configurable photo counts, hero counts, and orientation biases. Each shuffle runs the production layout engine and auto-captures metadata (success/failure, rejection reasons, timing, canvas geometry) to localStorage for batch export and offline analysis. Supports batch mode (Shuffle 25) for statistical sampling, saved photo sets for reproducible testing, and shows rejected layout geometry with rejection reason badges.

### `/layout-rating` -- Layout Rating
Supervised labeling tool for deriving layout quality rules. Generates a batch of ~44 stratified test cases covering different photo counts, hero counts, and canvas shapes, then presents each layout for thumbs-up/thumbs-down/skip rating. Users tag issues (hero-not-prominent, single-photo-row, wasted-space, etc.) or positives (well-balanced, hero-works, good-variety). Exports rated JSON for pattern analysis to calibrate scoring thresholds and quality gates.

### `/hero-fraction` -- Hero Fraction Rating
Calibration tool for hero area fraction targets. Uses CSS-only template previews (no layout engine) with stratified sampling across a 3x3 grid of canvas and hero aspect ratios (portrait/square/landscape) to ensure edge-case coverage. Supports multiple rating rounds with progressive refinement. Users tag qualitative issues (hero-too-large, cramped, bad-combo) and add notes. Exports JSON for tuning the fraction ranges used by the layout engine.

## Files changed

| File | Change |
|------|--------|
| `README.md` | Add "Dev Tools" subsection after the "Development" section |

