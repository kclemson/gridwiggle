

# Slow Down the Fade Animation

## What Changes
Make the fade-out/fade-in transition slower so it feels more gentle and pleasing. Currently the transition duration is 400ms -- increasing it to 700ms will give it a more relaxed, cinematic feel.

## Technical Details

### File: `src/components/SampleGallery.tsx`

1. **Line 25**: Increase the `setTimeout` delay from `400` to `700` so the index swap waits for the longer fade-out to complete
2. **Line 61**: Change the Tailwind duration class from `duration-[400ms]` to `duration-700`

