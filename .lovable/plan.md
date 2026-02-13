

# Fix: Server Smart Crop Should Only Crop When a Person Is Detected

## The Problem

The desktop DETR path has an explicit person-detection gate: `skipCrop = !hasPerson`. The server edge function prompt tells Gemini to crop around "main subjects" which includes everything -- dogs, Legos, text documents, UI screenshots. It always returns a crop and never signals `skipCrop`.

## The Fix

Two changes to `supabase/functions/smart-crop/index.ts`:

### 1. Update the system prompt to match DETR behavior

Replace the current system prompt with one that explicitly gates on person/face detection:

- Tell Gemini to first determine if there are **people or faces** in the image
- If yes: return the optimal crop region focusing on the people
- If no: return a special response indicating no crop should be applied (e.g., `"skipCrop": true`)
- Add `skipCrop` boolean to the required JSON response format

### 2. Pass `skipCrop` through the response

The edge function currently only returns `{ crop, confidence, subjects }`. Add `skipCrop` to the response so the client can respect it. The client (`serverSmartCropService.ts`) currently hardcodes `skipCrop: false` -- update it to use the server's value.

## Technical Details

### `supabase/functions/smart-crop/index.ts`

Update the system prompt to:

```text
You are an image analyzer that detects PEOPLE and FACES.

Your task:
1. Determine if there are any people or human faces in the image
2. If YES: return a crop region that keeps all people/faces visible with breathing room
3. If NO: set skipCrop to true -- do NOT crop non-person subjects

You must respond with ONLY a JSON object:
{
  "x": <percentage from left edge>,
  "y": <percentage from top edge>,
  "width": <percentage of image width>,
  "height": <percentage of image height>,
  "confidence": <0-1>,
  "subjects": "<what you see>",
  "skipCrop": <true if no people/faces detected, false if people found>
}
```

Update the response handling to pass through the `skipCrop` field from the AI response, defaulting to `false` for backwards compatibility. Include it in the returned JSON alongside `crop`, `confidence`, and `subjects`.

### `src/services/serverSmartCropService.ts`

Change the hardcoded `skipCrop: false` to use the server's returned value:

```typescript
return {
  crop,
  confidence: confidence ?? 0.7,
  subjects: subjects ?? 'server analysis',
  skipCrop: data.skipCrop ?? false,  // was: skipCrop: false
};
```

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/smart-crop/index.ts` | Person-gated system prompt + pass `skipCrop` in response |
| `src/services/serverSmartCropService.ts` | Use server's `skipCrop` value instead of hardcoded `false` |

## Expected Behavior After Fix

| Image content | Desktop (DETR) | Mobile (Server) Current | Mobile (Server) Fixed |
|---|---|---|---|
| Person photo | Crops to person | Crops to person | Crops to person (same) |
| Dog photo | skipCrop=true | Crops to dog | skipCrop=true (matches desktop) |
| Screenshot/text | skipCrop=true | Crops to content | skipCrop=true (matches desktop) |
| Landscape | skipCrop=true | Crops to "subject" | skipCrop=true (matches desktop) |

