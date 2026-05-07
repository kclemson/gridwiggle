/**
 * Lightweight EXIF capture-date extraction.
 *
 * Used to prefill the per-photo label input with the photo's actual capture
 * date so the user can accept it with one tap. Failure is silent — if the
 * file has no EXIF (PNG, edited image, etc.), the function returns null.
 */

import exifr from 'exifr';

function formatDate(d: Date): string {
  // M/D/YYYY using local components of the EXIF timestamp (no leading zeros)
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/**
 * Read the photo's capture date and return it as MM/DD/YYYY.
 * Returns null when no usable date is present or parsing fails.
 */
export async function extractCaptureDate(blob: Blob): Promise<string | null> {
  // EXIF only meaningfully exists on JPEG/HEIC/TIFF. Skip the rest cheaply.
  const type = (blob.type || '').toLowerCase();
  if (type && !/jpe?g|heic|heif|tiff?/.test(type)) return null;

  try {
    const data = await exifr.parse(blob, {
      pick: ['DateTimeOriginal', 'CreateDate', 'DateTime'],
    });
    const candidate: unknown =
      data?.DateTimeOriginal ?? data?.CreateDate ?? data?.DateTime;
    if (!candidate) return null;
    const d = candidate instanceof Date ? candidate : new Date(candidate as string);
    if (isNaN(d.getTime())) return null;
    return formatDate(d);
  } catch {
    return null;
  }
}