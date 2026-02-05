

# Update Branding: Favicon, OpenGraph, and Meta Tags

## Overview

Replace all Lovable placeholder content with GridWiggle branding using the provided assets and chosen description.

---

## Assets to Copy

| Source | Destination | Purpose |
|--------|-------------|---------|
| `user-uploads://smolmoji-grid-one.png` | `public/favicon.png` | Browser tab icon |
| `user-uploads://image-216.png` | `public/og-image.png` | Social sharing preview |

---

## Description

**Chosen**: "Turn any collection of photos into a perfectly arranged collage with one drop."

---

## Changes to index.html

### Remove
- `<meta name="author" content="Lovable" />`
- `<meta name="twitter:site" content="@Lovable" />`
- Old favicon.ico reference (if any)

### Update

| Tag | Before | After |
|-----|--------|-------|
| `<title>` | Lovable App | GridWiggle |
| `<link rel="icon">` | /favicon.ico | /favicon.png (with type="image/png") |
| `description` | Lovable Generated Project | Turn any collection of photos into a perfectly arranged collage with one drop. |
| `og:title` | Lovable App | GridWiggle |
| `og:description` | Lovable Generated Project | Turn any collection of photos into a perfectly arranged collage with one drop. |
| `og:image` | lovable.dev URL | https://gridwiggle.lovable.app/og-image.png |
| `twitter:image` | lovable.dev URL | https://gridwiggle.lovable.app/og-image.png |

---

## Final index.html Head Section

```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" type="image/png" href="/favicon.png" />
  <title>GridWiggle</title>
  <meta name="description" content="Turn any collection of photos into a perfectly arranged collage with one drop." />

  <meta property="og:title" content="GridWiggle" />
  <meta property="og:description" content="Turn any collection of photos into a perfectly arranged collage with one drop." />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="https://gridwiggle.lovable.app/og-image.png" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content="https://gridwiggle.lovable.app/og-image.png" />
</head>
```

---

## Files Summary

| File | Action |
|------|--------|
| `public/favicon.png` | Create (copy from user upload) |
| `public/og-image.png` | Create (copy from user upload) |
| `public/favicon.ico` | Delete (no longer needed) |
| `index.html` | Update all meta tags as described above |

