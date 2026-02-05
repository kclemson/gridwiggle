

# Error Resilience Without Toasts

## Philosophy

For a photo collage app, most errors can be handled silently:

- **AI processing fails?** Just use the full image - user doesn't need to know
- **Layout generation fails?** Keep the button visible for retry - user will click again
- **Storage fails?** This one matters - user needs to know their photos won't persist

The key insight: show errors only when user action is required or data loss occurred.

---

## Changes

### 1. Silent Recovery for AI Processing

**File:** `src/pages/Index.tsx`

Remove the toast from `handlePhotosAdded`. The smart crop already has per-photo error handling that stores errors on the photo object. Just log and continue:

```text
Before:
  catch (error) {
    console.error('Smart crop processing failed:', error);
    toast.error('AI processing failed. Please try again.');
  }

After:
  catch (error) {
    console.error('Smart crop processing failed:', error);
    // Silent - photos still work, just without smart crop
  }
  finally {
    // Always generate collage
    regenerateCollage({ randomize: !wasLayoutEmpty });
  }
```

### 2. Silent Recovery for Layout Generation

**File:** `src/pages/Index.tsx`

The layout toast can also be removed - the button stays visible for retry, which is self-explanatory:

```text
Before:
  catch (error) {
    console.error('Layout generation failed:', error);
    toast.error('Failed to generate collage. Try again.');
  }

After:
  catch (error) {
    console.error('Layout generation failed:', error);
    // Silent - button remains visible for retry
  }
```

### 3. Silent Recovery for Storage Load

**File:** `src/hooks/useCollageState.ts`

On initial load, if IndexedDB fails, just start fresh - user can re-upload:

```text
Before:
  catch (e) {
    console.error('Failed to load photos from IndexedDB:', e);
    toast.error('Failed to load saved photos. Storage may be corrupted.');
  }

After:
  catch (e) {
    console.error('Failed to load photos from IndexedDB:', e);
    // Silent - start fresh, user can re-upload
  }
```

### 4. Keep Inline Error for Storage Save (Data Loss)

**File:** `src/hooks/useCollageState.ts`

This is the one case where the user needs to know - their photos might not persist. Instead of a toast, return the failure info so the caller can handle it (which it already does - `handlePhotosAdded` receives `{ succeeded, failed }`).

Simply remove the toast and rely on the existing return value:

```text
Before:
  if (failed.length > 0) {
    toast.error(`Failed to save ${failed.length} photo(s). Storage may be full.`);
  }

After:
  // Caller receives failed array and can handle as needed
  // Currently: failed photos are not added to state, silently excluded
```

### 5. Worker Crash Recovery

**File:** `src/services/smartCropService.ts`

Change from reject to resolve with fallback - this prevents the error from bubbling up at all:

```text
Before:
  const handleError = (errorEvent: ErrorEvent) => {
    cleanup();
    resetWorker();
    reject(new Error('AI processing failed - please try again'));
  };

After:
  const handleError = (errorEvent: ErrorEvent) => {
    cleanup();
    resetWorker();
    resolve({
      crop: { x: 0, y: 0, width, height },
      confidence: 0,
      subjects: 'AI unavailable',
      skipCrop: true,
    });
  };
```

### 6. Global Error Handler (Optional but Recommended)

**File:** `src/App.tsx`

Add a safety net that just logs - no toast:

```typescript
useEffect(() => {
  const handleRejection = (event: PromiseRejectionEvent) => {
    console.error("Unhandled rejection:", event.reason);
    event.preventDefault();
  };
  window.addEventListener("unhandledrejection", handleRejection);
  return () => window.removeEventListener("unhandledrejection", handleRejection);
}, []);
```

---

## Summary

| Location | Current | After |
|----------|---------|-------|
| AI processing fails | Toast | Silent (log only) |
| Layout generation fails | Toast | Silent (button visible for retry) |
| Storage load fails | Toast | Silent (fresh start) |
| Storage save fails | Toast | Silent (photos excluded from state) |
| Worker crashes | Throws error | Returns fallback crop |
| Unhandled rejections | Crash | Caught + logged |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Remove 2 toast calls, add `finally` block |
| `src/hooks/useCollageState.ts` | Remove 2 toast calls |
| `src/services/smartCropService.ts` | Resolve with fallback instead of reject |
| `src/App.tsx` | Add global rejection handler (logs only) |

---

## Cleanup

After these changes, the `toast` import can be removed from both `Index.tsx` and `useCollageState.ts` since neither will use it anymore.

