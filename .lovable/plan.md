
# Fix: Stale Worker Response After Clear All

## Problem Analysis

Looking at the screenshot:
- Header shows "5 of 19 ready" (current batch still processing)
- Debug logs show `photoCount:20, contentCount:19` (from a **previous** generation)
- Rejection UI appears immediately with stale data

**Root Cause**: When "Clear All" is clicked (or new photos are uploaded), any in-flight worker requests from the **previous** photo set are not cancelled. When those stale responses arrive, they populate `rejectedLayout` and `debugLogs`, which then render because:

1. `state.layout` is null (cleared)
2. `rejectedLayout` is truthy (stale)
3. `readyPhotos >= 2` is true (5 photos are ready in the current batch)

The guard `readyPhotos >= 2` prevents the rejection UI when there are 0-1 ready photos, but doesn't detect that the rejection data is from a **different photo set**.

## Solution

Add a staleness check: the rejection UI should only render if the rejection's photo count **matches** the current ready photo count (within tolerance). If the rejection says "20 photos" but we only have 5 ready, it's clearly stale.

### Technical Change

**`src/pages/Index.tsx`** — Render logic (around line 718)

Current:
```tsx
) : rejectedLayout && readyPhotos >= 2 ? (
```

Fixed:
```tsx
) : rejectedLayout && readyPhotos >= 2 && !isRejectionStale ? (
```

Where `isRejectionStale` is derived from the rejection data vs current photos:

```typescript
// Detect stale rejection by comparing photo counts
// If rejection says "20 photos" but we only have 5 ready, it's from a previous session
const rejectedPhotoCount = rejectedLayout
  ? (rejectedLayout.details as any)?.photoCount ?? rejectedLayout.cells.length
  : 0;

// Stale if counts don't match (allowing small tolerance for timing)
const isRejectionStale = rejectedLayout && Math.abs(rejectedPhotoCount - readyPhotos) > 1;
```

Apply the same guard to `layoutError`:

```tsx
) : layoutError && readyPhotos >= 2 && !isRejectionStale ? (
```

## Why This Works

| Scenario | `rejectedPhotoCount` | `readyPhotos` | `isRejectionStale` | Shows UI? |
|----------|---------------------|---------------|-------------------|-----------|
| Stale rejection (20) during upload (5) | 20 | 5 | true | No |
| Stale rejection (20) during upload (19) | 20 | 19 | true | No |
| Fresh rejection (19) after all ready | 19 | 19 | false | Yes |
| Fresh rejection (5) with 5 photos | 5 | 5 | false | Yes |

## Alternative Considered: Bump `latestRequestIdRef` on Clear All

Could also bump the request ID counter when clearing, so stale worker responses are ignored. However, this doesn't cover the case where the user adds new photos before the old worker response arrives. The staleness check is more robust.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `isRejectionStale` derived value and use it to guard rejection/error UI |
