/**
 * Shape slider ↔ aspect ratio mapping utilities.
 *
 * Piecewise linear interpolation across 5 control points:
 *   Slider 0→0.55, 25→0.75, 50→1.0, 75→1.5, 100→2.0
 */

const CONTROL_POINTS: [number, number][] = [
  [0, 0.55],
  [25, 0.75],
  [50, 1.0],
  [75, 1.5],
  [100, 2.0],
];

function lerp(x: number, x0: number, x1: number, y0: number, y1: number): number {
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

/** Map slider position (0-100) to a target aspect ratio. */
export function sliderToTargetAR(position: number): number {
  const p = Math.max(0, Math.min(100, position));
  for (let i = 0; i < CONTROL_POINTS.length - 1; i++) {
    const [x0, y0] = CONTROL_POINTS[i];
    const [x1, y1] = CONTROL_POINTS[i + 1];
    if (p <= x1) return lerp(p, x0, x1, y0, y1);
  }
  return CONTROL_POINTS[CONTROL_POINTS.length - 1][1];
}

/** Map slider position to AR bounds (±20% tolerance), or null if no constraint. */
export function sliderToARBounds(
  position: number | null
): { minAR: number; maxAR: number } | null {
  if (position === null) return null;
  const target = sliderToTargetAR(position);
  return { minAR: target * 0.8, maxAR: target * 1.2 };
}

/** Map an actual aspect ratio back to slider position (0-100), clamped. */
export function arToSliderPosition(ar: number): number {
  // Clamp to range
  if (ar <= CONTROL_POINTS[0][1]) return 0;
  if (ar >= CONTROL_POINTS[CONTROL_POINTS.length - 1][1]) return 100;

  for (let i = 0; i < CONTROL_POINTS.length - 1; i++) {
    const [x0, y0] = CONTROL_POINTS[i];
    const [x1, y1] = CONTROL_POINTS[i + 1];
    if (ar <= y1) return lerp(ar, y0, y1, x0, x1);
  }
  return 100;
}
