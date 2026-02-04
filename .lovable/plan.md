

# Only Smart Crop When Person Detected

## Goal

Change the smart crop logic to ONLY apply when "person" is detected. All other detections (banana, potted plant, vase, etc.) should skip smart cropping and use the full image.

## Rationale

| Subject Detected | Typical Content | Action |
|-----------------|-----------------|--------|
| "person" | Real photos of people | Apply smart crop |
| Any other label | Landscapes, objects, cartoons | Skip - use full image |
| No detection | Memes, screenshots, abstract | Skip - use full image |

The DETR model:
- Reliably detects "person" in real photos (Picard: 1.00, Success Kid: 1.00)
- Hallucinates random objects in cartoons (Shrek: "banana", Spongebob house: "banana")
- Often fails to detect anything in memes (Lisa Simpson: 0.00)

By only trusting "person" detections, we get reliable smart cropping for photos that benefit most from it.

## Technical Change

### File: `src/workers/visionWorker.ts`

Update the skipCrop logic to check if any "person" was detected:

**Current code (around line 139-141):**
```typescript
// Skip smart cropping if confidence is too low (cartoons, memes, screenshots)
const skipCrop = maxConfidence < 0.6;
```

**New code:**
```typescript
// Only apply smart crop if a person was detected
// DETR hallucinates random objects (banana, vase) for cartoons
// but reliably detects "person" in real photos
const hasPerson = results.some(r => r.score > 0.4 && r.label === 'person');
const skipCrop = !hasPerson;
```

## Expected Behavior After Fix

| Image | Detection | skipCrop | Result |
|-------|-----------|----------|--------|
| picard.jpg | person (1.00) | false | Smart crop applied |
| successkid.webp | person (1.00) | false | Smart crop applied |
| shrek.webp | banana (0.96) | true | Full image |
| spongebobshouse2.jpg | banana (0.94) | true | Full image |
| lisasimpson.jpg | none (0.00) | true | Full image |

## Console Output After Fix

```
Smart crop for picard.jpg: confidence=1.00, subjects="person", skipCrop=false
Smart crop for successkid.webp: confidence=1.00, subjects="person", skipCrop=false
Smart crop for shrek.webp: confidence=0.96, subjects="banana", skipCrop=true
Smart crop for spongebobshouse2.jpg: confidence=0.94, subjects="banana", skipCrop=true
Smart crop for lisasimpson.jpg: confidence=0.00, subjects="No subjects detected", skipCrop=true
```

## Files Modified

| File | Change |
|------|--------|
| `src/workers/visionWorker.ts` | Change skipCrop to only be false when "person" is detected |

