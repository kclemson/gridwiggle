import { LabelPosition } from '@/types/collage';

/**
 * Resolve the label string to actually display for a photo.
 *
 * Semantics:
 * - `label === undefined` → user has never edited; fall back to suggestion.
 * - `label === ''`        → user explicitly cleared; show nothing.
 * - any other string      → user-provided label.
 */
export function getDisplayLabel(photo: { label?: string; suggestedLabel?: string }): string {
  if (photo.label !== undefined) return photo.label;
  return photo.suggestedLabel ?? '';
}

/** Pick black or white based on background luminance for legibility. */
export function autoTextColor(hexBg: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hexBg.trim());
  if (!m) return '#ffffff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Relative luminance (sRGB)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? '#000000' : '#ffffff';
}

/** CSS positioning for a label overlay div within a relatively-positioned cell. */
export function labelAnchorStyle(pos: LabelPosition): React.CSSProperties {
  const inset = '0px';
  const style: React.CSSProperties = { position: 'absolute' };
  if (pos.startsWith('t')) style.top = inset;
  else style.bottom = inset;
  if (pos.endsWith('l')) style.left = inset;
  else if (pos.endsWith('r')) style.right = inset;
  else {
    style.left = '50%';
    style.transform = 'translateX(-50%)';
  }
  return style;
}