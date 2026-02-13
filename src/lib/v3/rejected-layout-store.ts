/**
 * Rejected Layout Store
 * 
 * Simple module-level store for the last rejected layout,
 * used by the dev-only LayoutTest page for visualization.
 */

import type { RejectedLayout } from './types';

let lastRejectedLayout: RejectedLayout | null = null;

export function setRejectedLayout(layout: RejectedLayout) {
  lastRejectedLayout = layout;
}

export function getLastRejectedLayout(): RejectedLayout | null {
  return lastRejectedLayout;
}

export function clearRejectedLayout() {
  lastRejectedLayout = null;
}
