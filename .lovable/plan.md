
# Streamline Logging into Clean Telemetry

## What Changes for You

The edge function logs transform from noisy diagnostic output into a clean, scannable telemetry feed. Instead of dozens of internal lifecycle messages, you'll see compact timestamped one-liners showing what users actually do:

```
[s:a1b2c3] 26-02-14 18:50:14 session | desktop
[s:a1b2c3] 26-02-14 18:51:02 photos:5 | ARs: 0.75, 1.33, 1.0, 0.67, 1.5
[s:a1b2c3] 26-02-14 18:51:08 shuffle:5 | #3
[s:a1b2c3] 26-02-14 18:51:15 export:5
[s:a1b2c3] 26-02-14 18:52:01 error | layout: Generation failed
```

## Privacy Guarantees

Only numbers and categories -- no photo content, filenames, user identifiers, IPs, or device fingerprints. Session IDs are random UUIDs generated fresh each page load.

## Changes

### 1. Remove noisy log calls

**`src/hooks/useCollageState.ts`** -- Remove 5 `remoteLogger.info('indexeddb', ...)` calls (Starting initialization, Metadata loaded, Blobs loaded, Initialization complete) and the recovery warning. Keep only `remoteLogger.error` and `remoteLogger.warn('indexeddb', 'Storage not available')`.

**`src/hooks/useSmartCropProcessing.ts`** -- Remove all ~10 per-phase `remoteLogger.info('smartcrop', 'Phase: ...')` calls and the manual smart crop diagnostic logs. Keep only `remoteLogger.error` calls for failures.

**`src/services/smartCropService.ts`** -- Remove verbose worker lifecycle logs (Creating worker, Worker created, Worker check, Pre-postMessage, Result received, etc.). Keep only error logs and the mobile routing decision.

**`src/services/serverSmartCropService.ts`** -- Remove entry/result info logs. Keep error logs only.

### 2. Add telemetry events

**`src/hooks/useCollageGeneration.ts`**:
- Add `shuffleCountRef = useRef(0)`, increment when `randomize` is true
- Replace the existing `remoteLogger.info('layout', 'Regenerating collage', ...)` and `remoteLogger.info('layout', 'Layout generated', ...)` with a single post-success call:
  ```
  remoteLogger.info('telemetry', 'photos', {
    count: dimensions.length,
    aspectRatios: dimensions.map(d => +d.aspectRatio.toFixed(2)),
    heroCount: dimensions.filter(d => d.weight > 1).length,
  })
  ```
- When `randomize` is true, log instead:
  ```
  remoteLogger.info('telemetry', 'shuffle', {
    count: dimensions.length,
    shuffleNum: shuffleCountRef.current,
  })
  ```

**`src/hooks/useCollageExport.ts`**:
- Replace "Starting export" + "Export complete" with a single post-success:
  ```
  remoteLogger.info('telemetry', 'export', { count: photos.length })
  ```
- Keep the error log

**`src/hooks/useCollageState.ts`**:
- Add a single session-start log after initialization completes:
  ```
  remoteLogger.info('telemetry', 'session', { platform: isMobileDevice() ? 'mobile' : 'desktop' })
  ```

**`src/pages/Index.tsx`**:
- Remove the `remoteLogger.info('upload', 'Photos added', ...)` call (redundant -- the generation event already captures photo count)

### 3. Reformat the edge function with clear comments

**`supabase/functions/client-logs/index.ts`** -- Rewrite the log formatting to output compact one-liners. Add thorough comments explaining the purpose and design of the function for GitHub readability:

```typescript
/**
 * client-logs: Privacy-safe usage telemetry endpoint
 *
 * This edge function receives batched log entries from the client-side
 * remoteLogger and formats them as compact, human-readable lines in the
 * function's console output (viewable in Lovable Cloud logs).
 *
 * Design goals:
 * - Anonymous: session IDs are random UUIDs, no user identity or PII
 * - Minimal: only user actions (photos added, shuffle, export) + errors
 * - Scannable: one-liner format with timestamps and short session prefix
 *
 * Log format:
 *   [s:<session_prefix>] YY-MM-DD HH:MM:SS <event>:<count> | <extra>
 *
 * The client batches logs every 5 seconds (or immediately on errors)
 * and sends them as a JSON array. This function just reformats and prints.
 */
```

For telemetry-category logs, format as:
- `photos` -> `[s:abc123] 26-02-14 18:51:02 photos:5 | ARs: 0.75, 1.33, 1.0`
- `shuffle` -> `[s:abc123] 26-02-14 18:51:08 shuffle:5 | #3`
- `export` -> `[s:abc123] 26-02-14 18:51:15 export:5`
- `session` -> `[s:abc123] 26-02-14 18:50:14 session | desktop`
- errors -> `[s:abc123] 26-02-14 18:52:01 ERROR | category: message`

### 4. Files changed summary

| File | Action |
|------|--------|
| `src/hooks/useCollageState.ts` | Remove 5 info logs, add 1 session telemetry log |
| `src/hooks/useSmartCropProcessing.ts` | Remove ~10 per-phase info logs |
| `src/hooks/useCollageGeneration.ts` | Add shuffleCountRef, replace 2 info logs with telemetry events |
| `src/hooks/useCollageExport.ts` | Replace 2 info logs with 1 post-success telemetry log |
| `src/services/smartCropService.ts` | Remove ~12 verbose worker lifecycle logs |
| `src/services/serverSmartCropService.ts` | Remove 2 info logs |
| `src/pages/Index.tsx` | Remove 1 redundant upload log |
| `supabase/functions/client-logs/index.ts` | Reformat output, add comments |
