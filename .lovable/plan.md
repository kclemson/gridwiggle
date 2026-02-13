

# Open-Source Cleanup and README

## Changes

### 1. `.gitignore` updates

Add two entries:
- `.env` -- prevent backend keys from being pushed
- `.lovable/` -- keep internal AI notes local-only

### 2. Delete dead V3 entry point

Delete `src/lib/v3/index.ts`. Its only consumer is `layoutAdapter.ts`, which will be switched to V4.

### 3. Update `src/test/layout/layoutAdapter.ts`

Switch from `generateCollageLayoutV3` to `generateCollageLayoutV4` (from `@/lib/v4`). Adapt the options object shape to match V4's API.

### 4. Rename capture storage (remove "V3" branding)

Rename `src/lib/v3CaptureStorage.ts` to `src/lib/captureStorage.ts`. Inside the file:
- `V3LayoutCapture` becomes `LayoutCapture`
- `V3CaptureStore` becomes `CaptureStore`
- localStorage key `v3-layout-captures` becomes `layout-captures`
- Add migration: on load, check for old key, copy data to new key, delete old key

Update all importers:
- `src/pages/V3Test.tsx`
- `src/pages/Index.tsx`
- `src/components/DebugPanel.tsx`
- `src/components/debug/DebugLogPanel.tsx`
- `src/components/debug/CaptureControls.tsx`

### 5. Rename V3Test page

- Rename `src/pages/V3Test.tsx` to `src/pages/LayoutTest.tsx`
- Update page title from "V3 Layout Test" to "Layout Test"
- Update route and import in `src/App.tsx` (route changes from `/v3-test` to `/layout-test`)

### 6. Rewrite README.md

New README with:
- Project name and one-line description
- Screenshot thumbnail using `![GridWiggle screenshot](./public/og-image.png)`
- Features list (auto-layout, hero photos, smart crop, shuffle, export)
- Tech stack (React, TypeScript, Vite, Tailwind, shadcn/ui)
- Brief architecture note (V4 layout engine, Web Worker, constraint-based packing)
- Dev setup instructions (`npm i && npm run dev`)
- MIT license note

### 7. What stays as-is

- `.lovable/plan.md` -- kept locally, gitignored
- `src/lib/v3/` directory (types, utils, packing primitives) -- actively used by V4
- `src/components/V3TuningSection.tsx` -- references `V3Tuning` type, cosmetic rename not worth the churn
- Dev-only pages (LayoutRating, HeroFractionRating) -- good open-source dev tooling
- `remoteLogger.ts` -- production logging, fine to keep

## File summary

| File | Action |
|---|---|
| `.gitignore` | Add `.env` and `.lovable/` |
| `src/lib/v3/index.ts` | Delete |
| `src/lib/v3CaptureStorage.ts` | Rename to `src/lib/captureStorage.ts`, rename types |
| `src/pages/V3Test.tsx` | Rename to `src/pages/LayoutTest.tsx` |
| `src/test/layout/layoutAdapter.ts` | Switch V3 import to V4 |
| `src/App.tsx` | Update LayoutTest import and route |
| `src/pages/Index.tsx` | Update captureStorage import |
| `src/components/DebugPanel.tsx` | Update captureStorage import |
| `src/components/debug/DebugLogPanel.tsx` | Update captureStorage import |
| `src/components/debug/CaptureControls.tsx` | Update captureStorage import |
| `README.md` | Full rewrite with screenshot |

