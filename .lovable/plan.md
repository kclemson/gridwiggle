

# Pre-Publish Cleanup

## 1. `.gitignore` -- Add missing entries

Add `.env` and `.lovable/` to prevent Supabase credentials and internal planning notes from being committed.

```
.env
.lovable/
```

## 2. Edge function parse-failure fallback should skip crop

In `supabase/functions/smart-crop/index.ts` lines 133-142, when Gemini returns unparseable JSON, the fallback creates an 80% center crop with no `skipCrop` field. This means a garbled response on a dog photo still produces a crop. Change the fallback to:

```typescript
cropData = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  confidence: 0,
  subjects: "Unable to analyze",
  skipCrop: true,
};
```

This matches the fail-safe philosophy: when in doubt, don't crop.

## 3. Stale JSDoc in `serverSmartCropService.ts`

Update the doc comment (lines 71-76) from "detect subjects" to "detect people/faces", matching the actual behavior after the prompt change.

## 4. README update

Update the "AI smart crop" bullet and Tech Stack to mention the dual-path architecture:
- Desktop: on-device DETR model via Web Worker
- Mobile: server-side Gemini Flash vision (edge function)

## Files Changed

| File | Change |
|---|---|
| `.gitignore` | Add `.env` and `.lovable/` |
| `supabase/functions/smart-crop/index.ts` | Parse-failure fallback uses `skipCrop: true` |
| `src/services/serverSmartCropService.ts` | Update JSDoc comment |
| `README.md` | Mention server-side smart crop path for mobile |

