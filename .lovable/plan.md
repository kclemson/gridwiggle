

# Mobile Debugging & Testing Improvements

## What You're Experiencing

1. **Page crashes on iOS Safari** - The app loads photos and shows the carousel, but crashes before/during collage generation
2. **No manual regenerate button** - After a crash recovery, there's no way to retry collage generation from the carousel view
3. **"View All" is slow and shows wrong crops** - Using full-resolution images instead of thumbnails
4. **No way to see logs** - Mobile debugging is painful without console access

## What Changes For You

After this implementation:
- **Refresh icon in carousel** - One-tap button to manually trigger collage generation for testing
- **Remote log capture** - All errors and key events sent to an edge function, viewable via Lovable's edge function logs
- **Faster "View All"** - Uses 480px thumbnails instead of full-res images
- **Better crash visibility** - You'll see exactly where crashes occur (IndexedDB, smart crop, layout generation, etc.)

---

## Technical Plan

### 1. Add Refresh Button to PhotoCarousel

**File: `src/components/PhotoCarousel.tsx`**

Add a new prop `onRefresh` and a refresh icon button after "View All":

```typescript
interface PhotoCarouselProps {
  // ... existing props ...
  onRefresh: () => void;  // NEW
}

// In the action buttons section, after View All:
<Button
  variant="outline"
  size="sm"
  onClick={(e) => {
    e.stopPropagation();
    onRefresh();
  }}
  className="gap-1.5"
>
  <RefreshCw className="h-4 w-4" />
</Button>
```

**File: `src/pages/Index.tsx`**

Pass the handler to PhotoCarousel:
```typescript
<PhotoCarousel
  // ... existing props ...
  onRefresh={handleCreateCollage}
/>
```

---

### 2. Create Remote Logging Edge Function

**File: `supabase/functions/client-logs/index.ts`**

A simple edge function that receives logs from the client and outputs them to the function's console (viewable in Lovable Cloud edge function logs):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, ...',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { logs, sessionId, userAgent } = await req.json();
    
    console.log('=== CLIENT LOGS ===');
    console.log('Session:', sessionId);
    console.log('User-Agent:', userAgent);
    
    for (const log of logs) {
      console.log(`[${log.level}] ${log.category}: ${log.message}`, log.data ?? {});
    }
    
    console.log('=== END LOGS ===');
    
    return new Response(JSON.stringify({ received: logs.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Log ingestion error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process logs' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

---

### 3. Create Production Logger

**File: `src/lib/remoteLogger.ts`**

A logger that works in production and batches logs to the edge function:

```typescript
import { supabase } from '@/integrations/supabase/client';

interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: Record<string, unknown>;
}

const sessionId = crypto.randomUUID();
let logBuffer: LogEntry[] = [];
let flushTimeout: number | null = null;

export const remoteLogger = {
  log(level: 'info' | 'warn' | 'error', category: string, message: string, data?: Record<string, unknown>) {
    // Always log to console
    const consoleFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`[${category}] ${message}`, data ?? {});
    
    // Buffer for remote sending
    logBuffer.push({
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    });
    
    // Flush immediately on errors, otherwise debounce
    if (level === 'error') {
      this.flush();
    } else {
      this.scheduleFlush();
    }
  },
  
  info(category: string, message: string, data?: Record<string, unknown>) {
    this.log('info', category, message, data);
  },
  
  warn(category: string, message: string, data?: Record<string, unknown>) {
    this.log('warn', category, message, data);
  },
  
  error(category: string, message: string, data?: Record<string, unknown>) {
    this.log('error', category, message, data);
  },
  
  scheduleFlush() {
    if (flushTimeout) return;
    flushTimeout = window.setTimeout(() => {
      this.flush();
    }, 5000);  // Batch every 5 seconds
  },
  
  async flush() {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    
    if (logBuffer.length === 0) return;
    
    const logsToSend = [...logBuffer];
    logBuffer = [];
    
    try {
      await supabase.functions.invoke('client-logs', {
        body: {
          logs: logsToSend,
          sessionId,
          userAgent: navigator.userAgent,
        },
      });
    } catch (e) {
      // Silent - don't let logging failures break the app
      console.error('Failed to send logs:', e);
    }
  },
};

// Flush on page unload
window.addEventListener('beforeunload', () => {
  remoteLogger.flush();
});
```

---

### 4. Instrument Critical Code Paths

**File: `src/pages/Index.tsx`**

Add logging at key points:

```typescript
import { remoteLogger } from '@/lib/remoteLogger';

// In handlePhotosAdded:
remoteLogger.info('upload', 'Photos added', { count: newPhotos.length });

// In processSmartCrops:
remoteLogger.info('smartcrop', 'Starting processing', { photoId: photo.id });
// On error:
remoteLogger.error('smartcrop', 'Failed', { photoId: photo.id, error: error.message });

// In regenerateCollage:
remoteLogger.info('layout', 'Regenerating collage', { photoCount: photos.length });
// On success:
remoteLogger.info('layout', 'Layout generated', { cells: layout.cells.length });
// On error:
remoteLogger.error('layout', 'Generation failed', { error: error.message });
```

**File: `src/hooks/useCollageState.ts`**

Add logging for IndexedDB operations:

```typescript
import { remoteLogger } from '@/lib/remoteLogger';

// In loadInitialState:
remoteLogger.info('indexeddb', 'Loading photos', {});
// On error:
remoteLogger.error('indexeddb', 'Load failed', { error: e.message });

// In addPhotos:
remoteLogger.info('indexeddb', 'Saving photo', { photoId: photo.id });
// On error:
remoteLogger.error('indexeddb', 'Save failed', { photoId: photo.id, error: e.message });
```

**File: `src/App.tsx`**

Log unhandled rejections:

```typescript
import { remoteLogger } from '@/lib/remoteLogger';

const handleRejection = (event: PromiseRejectionEvent) => {
  remoteLogger.error('unhandled', 'Promise rejection', { 
    reason: event.reason?.message ?? String(event.reason) 
  });
  event.preventDefault();
};
```

---

### 5. Fix ThumbnailNavigator Performance

**File: `src/components/ThumbnailNavigator.tsx`**

Use `thumbnailUrl` instead of `objectUrl`:

```typescript
// In CroppedImage usage:
<CroppedImage
  src={photo.objectUrl}
  previewSrc={photo.previewUrl}
  thumbnailSrc={photo.thumbnailUrl}  // ADD
  crop={crop}
  ...
/>

// In img fallback:
<img
  src={photo.thumbnailUrl ?? photo.previewUrl ?? photo.objectUrl}
  ...
/>
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/components/PhotoCarousel.tsx` | Add `onRefresh` prop and refresh button |
| `src/pages/Index.tsx` | Pass `onRefresh` handler, add remote logging |
| `supabase/functions/client-logs/index.ts` | NEW - Edge function for log ingestion |
| `src/lib/remoteLogger.ts` | NEW - Production logger with batching |
| `src/hooks/useCollageState.ts` | Add IndexedDB operation logging |
| `src/App.tsx` | Log unhandled rejections remotely |
| `src/components/ThumbnailNavigator.tsx` | Use thumbnails instead of full-res |
| `supabase/config.toml` | Register new edge function |

## How to Debug

After this is deployed:

1. **Reproduce the crash on your phone**
2. **Go to Lovable Cloud → Edge Functions → client-logs → Logs**
3. **Look for your session's logs** - you'll see the exact sequence of events leading up to the crash

The logs will show you:
- Whether IndexedDB operations completed
- Whether smart cropping started/failed
- Whether layout generation was attempted
- Any unhandled promise rejections

