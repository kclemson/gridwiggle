

# Sync the Fallback Path to V4

## The Problem

The layout system has two code paths:

| Path | Engine | Thread | When |
|---|---|---|---|
| Worker (normal) | V4 | Background | Worker available |
| Sync fallback | V3 (old!) | Main thread | Worker crash or timeout |

When the worker fails, you get a double penalty: the fallback runs the outdated V3 algorithm (producing worse layouts) AND it runs on the main thread (freezing the UI).

## The Fix

Replace the sync fallback so it calls V4 instead of V3, matching what the worker does.

### File: `src/services/layoutGenerationService.ts`

1. Change the dynamic import from `@/lib/v3` to `@/lib/v4`
2. Call `generateCollageLayoutV4` instead of `generateCollageLayoutV3`
3. Remove the mock `PhotoItem[]` construction -- V4's `generateCollageLayoutV4` accepts `PhotoItem[]` directly (same as V3 did), so the stub-building stays but points at V4
4. Propagate `softRejection` and `layoutMeta` from V4's result into the `LayoutGenerationResult` return value, so debug info is available even on the fallback path

### What this does NOT change

- The worker path stays exactly the same (it already runs V4 inline)
- No new dependencies or files
- The fallback still runs on the main thread (unavoidable if the worker is dead), but at least produces the same quality layout

## Technical Detail

The current fallback calls:
```
const { generateCollageLayoutV3 } = await import('@/lib/v3');
```

It will change to:
```
const { generateCollageLayoutV4 } = await import('@/lib/v4');
```

And use V4's API, which returns `{ layout, layoutMeta }` instead of a bare `CollageLayout | null`. The soft-reject info and layout metadata will be threaded through to the caller.

The mock `PhotoItem` construction stays because V4 also expects `PhotoItem[]` as input (it calls `extractPhotoDimensions` internally). The shape is identical.

