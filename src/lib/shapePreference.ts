/**
 * Shape preference → canvas AR bounds.
 *
 * The user picks an intent ('auto' | 'portrait' | 'square' | 'landscape');
 * this maps to a canvas aspect-ratio band that the layout engine uses to
 * constrain candidate canvases. 'auto' returns null → no constraint.
 */

export type ShapePreference = 'auto' | 'portrait' | 'square' | 'landscape';

const BOUNDS: Record<Exclude<ShapePreference, 'auto'>, { minAR: number; maxAR: number }> = {
  portrait: { minAR: 0.55, maxAR: 0.85 },
  square: { minAR: 0.85, maxAR: 1.15 },
  landscape: { minAR: 1.15, maxAR: 2.0 },
};

/** Return AR bounds for a preference, or null when 'auto' (no constraint). */
export function shapePreferenceToARBounds(
  pref: ShapePreference,
): { minAR: number; maxAR: number } | null {
  if (pref === 'auto') return null;
  return BOUNDS[pref];
}