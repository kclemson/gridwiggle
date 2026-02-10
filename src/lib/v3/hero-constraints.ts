/**
 * Hero Placement Constraints
 *
 * Derived from 4 rounds of visual rating (~120 trials).
 * These are NOT enforced in the engine yet — this file serves
 * as the single source of truth for when we're ready to encode them.
 *
 * SINGLE HERO:
 * - General area range: 0.15 - 0.60
 * - Square canvas (AR 0.85-1.15) ceiling: 0.35
 * - Floor TBD (not yet stress-tested below 0.20)
 *
 * DUAL HERO:
 * - Combined area range: 0.22 - 0.42
 *
 * TEMPLATE RESTRICTIONS:
 * - Band templates (top/bottom/left/right-band):
 *     only on square-ish canvases (AR 0.85-1.15)
 * - side-by-side: banned on portrait canvases
 * - top-bottom: banned on landscape canvases
 *
 * RELIABLE TEMPLATES:
 * - corner-anchor: works on all canvas shapes
 * - diagonal-corners: works on all canvas shapes (dual hero)
 */
