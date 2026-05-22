import type { PhotoItem, CollageLayout } from '@/types/collage';

export type LabelMode = 'date' | 'number' | 'custom' | 'none';

/**
 * Compute the label string to assign to each photo for a given preset.
 *
 * - `date`   → photo's EXIF-derived `suggestedLabel` (empty string if missing).
 * - `number` → 1-based index in the current layout's reading order
 *              (top-left → bottom-right). Falls back to array order when
 *              no layout exists yet.
 */
export function computeLabels(
  mode: 'date' | 'number',
  photos: PhotoItem[],
  layout: CollageLayout | null,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (mode === 'date') {
    for (const p of photos) {
      out[p.id] = p.suggestedLabel ?? '';
    }
    return out;
  }

  // Number mode — order by layout cells, then append any stragglers.
  const photoIds = new Set(photos.map((p) => p.id));
  const order: string[] = [];
  if (layout) {
    for (const cell of layout.cells) {
      if (photoIds.has(cell.photoId) && !order.includes(cell.photoId)) {
        order.push(cell.photoId);
      }
    }
  }
  for (const p of photos) {
    if (!order.includes(p.id)) order.push(p.id);
  }
  order.forEach((id, i) => {
    out[id] = String(i + 1);
  });
  return out;
}

/**
 * Inspect the current labels and decide which preset (if any) they match.
 * Used to highlight the "active" action button and to drive auto-resync
 * when photos are added or the layout is shuffled.
 */
export function detectLabelMode(
  photos: PhotoItem[],
  layout: CollageLayout | null,
  showLabelPlaceholders: boolean,
): LabelMode {
  if (photos.length === 0) return 'none';

  const anyLabel = photos.some((p) => (p.label ?? '').length > 0);
  if (!anyLabel) return showLabelPlaceholders ? 'custom' : 'none';

  // Date: every photo with a suggestedLabel has label === suggestedLabel,
  // and photos without a suggestion have an empty label (date unavailable).
  const allDates = photos.every((p) =>
    p.suggestedLabel
      ? p.label === p.suggestedLabel
      : (p.label ?? '') === '',
  );
  // Require at least one real date so an empty set doesn't read as "date".
  const someDates = photos.some((p) => !!p.suggestedLabel && p.label === p.suggestedLabel);
  if (allDates && someDates) return 'date';

  // Number: labels match the 1..N sequence in layout order.
  const expected = computeLabels('number', photos, layout);
  const allNumbered = photos.every((p) => p.label === expected[p.id]);
  if (allNumbered) return 'number';

  return 'custom';
}