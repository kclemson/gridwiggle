

# Add Help Page

## New Files

### `src/pages/Help.tsx`
A clean, minimal page matching the app's style with a back arrow and polished copy:

```
gridwiggle

How It Works

- Create a great-looking photo collage in seconds -- just upload your photos
  and hit shuffle.

- Upload as many photos as you like. There's no limit.

- Photos with people are automatically cropped to keep faces in frame.
  You can fine-tune the crop on any photo by tapping it.

- Mark one or two photos as a "hero" using the star icon to give them
  extra prominence in the layout.

- Tap the shuffle button to generate a new layout. Keep going until you
  find one you love.

- When you're happy, tap download to save your collage as a PNG.
```

Uses a `Link` back arrow (ArrowLeft icon) to `/` in the header, same sticky header style as Index.

## Modified Files

### `src/pages/Index.tsx` (line ~684)
Add a `HelpCircle` icon button linking to `/help`, right-aligned in the header.

### `src/App.tsx`
Add `<Route path="/help" element={<Help />} />` above the catch-all route (outside the DEV-only block).

## Three total changes, two files modified, one file created.

