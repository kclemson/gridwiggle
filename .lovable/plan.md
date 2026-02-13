

# Clean Up Code Quality Issues

## What Changes

Fix four items that look sloppy to anyone browsing the repo.

## 1. Delete placeholder test -- `src/test/example.test.ts`

The `expect(true).toBe(true)` test is pure scaffolding. The project has real tests in `src/test/layout/` and `src/test/CroppedImage.test.tsx`. Delete this file entirely.

## 2. Remove duplicate postMessage -- `src/workers/visionWorker.ts`

Lines 141-142 send the exact same "Inference done" message twice. Remove the duplicate (line 142).

## 3. Fix `as any[]` cast -- `src/services/layoutGenerationService.ts`

Line 108 casts to `as any[]` to satisfy the `PhotoItem[]` type. Add the missing `smartCropAttempted` field to the stub object so it properly satisfies `PhotoItem` without the cast.

## 4. Brand the 404 page -- `src/pages/NotFound.tsx`

- Remove unused `useLocation` import
- Add GridWiggle branding (matching the header style from Help page)
- Keep it minimal but consistent with the app's look

## Technical Details

| File | Change |
|---|---|
| `src/test/example.test.ts` | Delete |
| `src/workers/visionWorker.ts` | Remove duplicate line 142 |
| `src/services/layoutGenerationService.ts` | Add `smartCropAttempted: false` to stub, remove `as any[]` |
| `src/pages/NotFound.tsx` | Remove unused import, add GridWiggle branding, dark background |

No functional changes to the app.

