

# Add PWA Support (Mobile + Desktop)

## What This Does

Makes GridWiggle installable as a standalone app on phones AND PCs. On desktop browsers (Chrome, Edge), users get an install icon in the address bar. On mobile, the standard "Add to Home Screen" flow works. The app launches without browser chrome on all platforms.

## Changes

### 1. Install `vite-plugin-pwa`

New dev dependency.

### 2. Update `vite.config.ts`

Add VitePWA plugin with manifest and Workbox caching:

```typescript
import { VitePWA } from "vite-plugin-pwa";

// In plugins array:
VitePWA({
  registerType: "autoUpdate",
  workbox: {
    navigateFallbackDenylist: [/^\/~oauth/],
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
  },
  manifest: {
    name: "GridWiggle",
    short_name: "GridWiggle",
    description: "Turn any collection of photos into a perfectly arranged collage in seconds.",
    theme_color: "#ffffff",
    background_color: "#ffffff",
    display: "standalone",
    scope: "/",
    start_url: "/",
    icons: [
      { src: "/favicon.png", sizes: "192x192", type: "image/png" },
      { src: "/favicon.png", sizes: "512x512", type: "image/png" },
      { src: "/favicon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    screenshots: [],
  },
})
```

Key details for desktop support:
- `display: "standalone"` -- launches without browser chrome on all platforms
- `start_url: "/"` and `scope: "/"` -- required for Chrome/Edge desktop install prompt
- `maskable` icon entry -- needed for adaptive icon rendering on some platforms

### 3. Update `index.html`

Add PWA meta tags in `<head>`:

```html
<meta name="theme-color" content="#ffffff" />
<link rel="apple-touch-icon" href="/favicon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
```

### 4. No other files needed

The vite-plugin-pwa auto-generates the service worker and injects the manifest link into the HTML at build time.

## How to Install

- **Desktop Chrome/Edge**: Click the install icon in the address bar (or three-dot menu > "Install GridWiggle")
- **macOS Safari**: Not natively supported for PWAs (Safari limitation)
- **iOS**: Share > "Add to Home Screen"
- **Android**: Browser menu > "Install app" or the automatic install banner

