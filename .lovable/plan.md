
# ✅ COMPLETED: Unified Layout Engine

## What Was Done

Extracted the V4 layout algorithm into a single shared module (`src/lib/v4/engine.ts`) that both the Web Worker and the sync fallback import. This eliminated ~1,000 lines of duplicated code and fixed scoring drift between the two paths.

### Files Changed

| File | Before | After |
|---|---|---|
| `src/lib/v4/engine.ts` | New | ~750 lines — shared algorithm core |
| `src/lib/v4/index.ts` | 1113 lines | ~85 lines — thin wrapper (extractPhotoDimensions + API) |
| `src/workers/layoutWorker.ts` | 1163 lines | ~95 lines — thin message handler |
| `src/services/layoutGenerationService.ts` | 212 lines | ~165 lines — calls engine directly, no PhotoItem stubs |

### Bugs Fixed During Unification

1. **Worker dual-hero used hard rejects** → now uses soft penalties (canonical v4 behavior)
2. **Worker single-region scoring used `tierCoherenceScore`** → now uses `scoreCellBalance` (unified scorer)
3. **Worker dual-hero fallback only on 0 candidates** → now falls back when best score ≤ 0.10
4. **Fallback path built unnecessary PhotoItem stubs** → now passes dimensions directly
