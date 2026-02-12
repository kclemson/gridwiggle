

# Fix: Download Button Should Save Directly, Not Open Share Picker

## Problem
On production (Windows desktop), clicking "Download" opens the OS Share dialog instead of saving to the Downloads folder. This is because `shareOrDownload()` uses `navigator.canShare()` which returns `true` on modern Windows browsers, triggering `navigator.share()` instead of the direct download path.

In dev mode on localhost, `canShare` returns `false`, so the download works as expected -- hiding this bug during development.

## Design Intent
The share picker should only appear on mobile devices where users expect to share to apps. On desktop, clicking download should always save to the Downloads folder.

## Fix

### File: `src/lib/exportCollage.ts` (~line 83)

Gate the share path behind `isMobileDevice()` so that only phones/tablets get the share picker. Desktop always gets a direct download.

```typescript
import { isMobileDevice } from '@/lib/platform';

export async function shareOrDownload(blob: Blob, filename: string): Promise<void> {
  // Only use Web Share API on mobile devices
  if (isMobileDevice()) {
    const file = new File([blob], filename, { type: 'image/png' });
    const shareData = { files: [file] };
    
    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        // Fall through to download
      }
    }
  }
  
  // Desktop always gets direct download
  downloadBlob(blob, filename);
}
```

The existing `isMobileDevice()` helper in `src/lib/platform.ts` already handles the detection via User-Agent. No new dependencies or files needed.

## What does NOT change
- Mobile behavior (still gets the share picker)
- Export resolution (still 2x)
- Download filename format
