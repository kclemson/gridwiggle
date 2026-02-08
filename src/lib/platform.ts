/**
 * Platform detection utilities for device-specific behavior.
 */

/**
 * Detect if running on a mobile device (phone/tablet).
 * Uses User-Agent for reliable device detection (not viewport width).
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  
  // Match phones and tablets
  return /android|iphone|ipad|ipod|webos|blackberry|iemobile|opera mini/i.test(ua);
}
