

## Design intent
When the user hits “Refresh”, we want the UI to communicate “work is happening” with a spinner that actually animates and with no “frozen” feel. Right now, even though the spinner renders, the main thread is still getting blocked by synchronous layout generation, so animation frames can’t advance (the spinner looks stuck). This same blocking also makes the app feel slow/unresponsive.

## User outcomes
After this change:
- The purple spinner will visibly rotate during generation (not just appear).
- The refresh icon spin will also be smooth.
- The UI remains responsive while layout is being computed (no “stutter/freeze”).
- Generation still finishes with the same layout quality, but feels much faster because feedback is continuous.

## What’s actually causing the spinner to “not spin”
CSS spinners need the browser to run animation frames. Your layout generation is CPU-heavy synchronous JavaScript. While that JS runs, the browser can’t render new frames—so the spinner can’t rotate and the page feels “stuck”.

The fix is not another timing tweak; it’s to stop doing the heavy work on the main thread.

## Implementation approach (move layout generation off the main thread)
We’ll run layout generation inside a Web Worker (you already have a proven worker pattern in `smartCropService` + `visionWorker.ts`). The main thread stays free to animate and respond to input.

### Step 1: Create a dedicated layout worker
Add a new worker file:
- `src/workers/layoutWorker.ts`

Responsibilities:
- Receive a message containing only the layout-relevant inputs (no blobs/object URLs).
- Run the V3 layout computation.
- Post back the resulting `CollageLayout | null`, plus optional debug info (timings, rejection reason, dev logs).

Message contract (example):
- Request:
  - `type: 'generate'`
  - `requestId: string`
  - `dimensions: { id, aspectRatio, weight }[]` (this is already the V3-native input type)
  - `normalizedGap: number`
  - `tuning: V3Tuning`
  - `randomize: boolean`
- Response:
  - `type: 'result'`
  - `requestId: string`
  - `layout: CollageLayout | null`
  - `durationMs: number`
  - `logs?: LogEntry[]` (optional, for the debug panel)
  - `failure?: { reason: string; details?: any }` (optional)

Key point: sending `PhotoDimension[]` avoids cloning large photo blobs to the worker.

### Step 2: Extract “dimension building” into main thread (cheap)
In `Index.tsx` (inside `regenerateCollage`) we will:
- Use existing `getDisplayCrop(photo)` to compute effective aspect ratio (this is lightweight).
- Convert photos → `PhotoDimension[]`:
  - `id`
  - `aspectRatio`
  - `weight` (from priority/photoWeights)
- Compute `normalizedGap` from `settings.gapSize`

This keeps crop logic centralized and avoids refactoring crop utils for worker compatibility.

### Step 3: Add a worker-backed generation service (singleton pattern)
Add a small service similar to `smartCropService.ts`:
- `src/services/layoutGenerationService.ts` (name flexible)

Responsibilities:
- Create/hold a singleton worker instance:
  - `new Worker(new URL('../workers/layoutWorker.ts', import.meta.url), { type: 'module' })`
- Provide `generateLayoutV3InWorker(payload): Promise<Result>`
- Handle:
  - timeouts (e.g., 10s; configurable)
  - worker crash fallback (terminate and recreate)
  - clean event listeners per request

Also include a safe fallback:
- If worker creation fails (older browsers), fall back to the current synchronous `generateCollageLayoutV3` path so the app still works.

### Step 4: Update `regenerateCollage` to be async + cancel-safe
In `src/pages/Index.tsx`:
- Replace the current `setTimeout(... heavy sync work ...)` with:
  1) `setIsGenerating(true)`
  2) Start an async worker request
  3) When it returns, set layout + errors
  4) `setIsGenerating(false)`

Important: handle “stale results”
- If the user clicks refresh multiple times quickly, we must ignore old results.
- Implement a `requestId` (incrementing counter or uuid) stored in a ref:
  - `latestRequestIdRef.current = requestId`
  - On worker response: only apply if it matches latest.

This ensures UI correctness and prevents flicker/race bugs.

### Step 5: Spinner behavior after worker change
Once generation is off-main-thread:
- The existing overlay spinner you added should animate normally (no special delays needed).
- We can remove the 50ms timer “hack” because it’s no longer necessary.

Optional polish (recommended):
- Add a minimum spinner display time (e.g., 150–250ms) to avoid “blink” when generation is extremely fast, while still remaining responsive.

### Step 6: Add instrumentation so “feels slow” becomes measurable
Add timing logs:
- Capture `durationMs` in the worker and post it back.
- Log on the main thread via existing `remoteLogger.info('layout', ...)`:
  - `{ durationMs, photoCount, usedWorker: true }`

This helps confirm whether “slow feel” was actual compute time or UI blocking.

## Files to change / add
- Add: `src/workers/layoutWorker.ts`
- Add: `src/services/layoutGenerationService.ts`
- Edit: `src/pages/Index.tsx`
  - Use worker-based generation
  - Add requestId/stale response handling
  - Remove the now-unnecessary `setTimeout(50)` path (or keep fallback only)

Optional (if we want dev logs preserved exactly as today):
- Small adjustment so the worker returns `devLogger.getLogs()` and Index continues to show them in the Debug Panel.

## Risks & edge cases
- Worker module bundling: Vite supports module workers (you already use them), so this should be straightforward.
- Debug logging: `devLogger` in worker won’t automatically populate the main-thread debug panel unless we explicitly post logs back.
- Determinism: `randomize` relies on `Math.random()` in the worker; that’s fine (same behavior class as today).

## Test plan (end-to-end)
1) Load a large set (30–50 photos).
2) Click Refresh repeatedly:
   - Spinner should visibly spin continuously.
   - UI should remain responsive (scroll/tap should not “freeze”).
   - Only the latest click’s layout should apply (no stale overwrites).
3) Toggle hero star and change settings (gap/shape):
   - Generation still works and spinner animates.
4) Verify fallback:
   - Simulate worker creation failure (dev toggle or forced code path) and ensure old synchronous mode still functions.

