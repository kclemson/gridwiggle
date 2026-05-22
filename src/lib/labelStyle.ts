import { LabelPosition } from '@/types/collage';

/** Text shown in the preview when "Custom labels" is active but a cell has no label. */
export const PLACEHOLDER_LABEL_TEXT = 'Tap to add label';

/**
 * Resolve the label string to actually display for a photo.
 *
 * Returns the photo's explicit label only — no suggestedLabel fallback.
 * Labels are now opt-in via the Date/Number/Custom actions in the
 * Add labels control, so an undefined label means "no label rendered."
 * The crop editor still treats `suggestedLabel` as a default value when
 * the user opens the field manually.
 */
export function getDisplayLabel(photo: { label?: string; suggestedLabel?: string }): string {
  return photo.label ?? '';
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

/**
 * Label font size in pixels for a collage of the given pixel dimensions.
 * Single source of truth shared by the on-screen preview and the PNG
 * export so labels render at the same visual fraction of the canvas
 * regardless of output resolution.
 *
 * Pure proportional: 3.5% of the shorter dimension (matches CSS
 * `3.5cqmin` in CollagePreview). No floors/ceilings — keeps preview and
 * export visually identical at any resolution.
 */
export function labelFontPx(canvasWidthPx: number, canvasHeightPx: number): number {
  return Math.min(canvasWidthPx, canvasHeightPx) * 0.035;
}