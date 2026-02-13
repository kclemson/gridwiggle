
# Add Portfolio Footer

## What Users See

A subtle footer below the settings row showing "made by kcloadletter.com" as a centered link, matching the muted style from the reference image. Clicking it opens the portfolio site in a new tab without stripping the HTTP referrer.

## Technical Changes

### File: `src/pages/Index.tsx`

Add a footer element after the `</main>` closing tag (around line 833), before the crop editor conditional block:

```html
<footer className="py-4 text-center">
  <a
    href="https://kcloadletter.com"
    target="_blank"
    rel="noopener"
    className="text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
  >
    made by kcloadletter.com
  </a>
</footer>
```

Key detail: uses `rel="noopener"` only -- deliberately omits `noreferrer` so the destination site receives the HTTP Referer header. This ensures your analytics can see traffic coming from GridWiggle.

### No other files changed

Single insertion, no new components or dependencies.
