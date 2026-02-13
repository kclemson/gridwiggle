# GridWiggle

Auto-layout photo collage maker. Upload photos, pick a hero, and get a beautiful grid collage — no manual arranging needed.

![GridWiggle screenshot](./public/og-image.png)

## Features

- **Auto-layout** — constraint-based packing produces balanced, beautiful grids automatically
- **Hero photos** — mark one or two photos as heroes for visual prominence
- **AI smart crop** — on-device vision model detects faces and subjects for optimal cropping
- **Shuffle** — regenerate layouts instantly for variety
- **Export** — download high-resolution PNG collages

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Web Worker for non-blocking layout generation
- On-device vision model (Hugging Face Transformers.js)

## How It Works

The layout engine uses constraint intersection and sub-rectangle decomposition to pack photos into a grid. Hero photos get area-based prominence (not just width). The algorithm evaluates multiple canvas partitioning strategies and scores them on area uniformity, shape compliance, and hero prominence — then picks the best one.

Layout generation runs in a Web Worker so the UI stays responsive.

## Development

```sh
npm i
npm run dev
```

Dev-only pages are available at `/layout-test`, `/layout-rating`, and `/hero-fraction` for algorithm tuning.

## License

MIT
