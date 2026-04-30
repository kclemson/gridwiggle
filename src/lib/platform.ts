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

/**
 * Detect iOS (including iPadOS, which masquerades as Mac).
 * iOS Safari/Chrome both use WebKit and share its restriction that
 * navigator.share() / programmatic <a download> require an
 * un-consumed user-gesture activation.
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac; disambiguate via touch support.
  return ua.includes('Mac') && typeof document !== 'undefined' && 'ontouchend' in document;
}
