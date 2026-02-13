
# Clean Up Template / Boilerplate Code

## What Changes

Remove files and code left over from Lovable's starter template that have no role in GridWiggle. This makes the repo clean and purposeful before syncing to GitHub.

## Items to Remove

### 1. `src/App.css` -- Vite starter CSS (dead file)
This is the default Vite/React template stylesheet (`.logo`, `.logo-spin`, `.read-the-docs`). Nothing imports it. Delete the entire file.

### 2. `public/placeholder.svg` -- Lovable default placeholder image (dead file)
The generic image placeholder SVG. Nothing references it. Delete.

### 3. `src/components/NavLink.tsx` -- Unused wrapper component (dead file)
A NavLink compatibility wrapper that nothing imports. Delete.

### 4. `README.md` -- Replace Lovable boilerplate with project README
Currently contains generic Lovable instructions with `REPLACE_WITH_PROJECT_ID` placeholders. Replace with a short GridWiggle-specific README (project name, one-line description, tech stack, dev instructions).

### 5. `src/App.tsx` line 44 -- Remove template comment
The comment `{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}` is Lovable scaffolding. Remove it.

## Items Reviewed and Kept

| File | Verdict |
|---|---|
| `index.html` | Already customized for GridWiggle (title, OG tags, favicon) -- keep as-is |
| `src/index.css` | Fully customized dark theme -- keep |
| `src/main.tsx` | Minimal, no boilerplate -- keep |
| `src/pages/NotFound.tsx` | Functional 404 page -- keep |
| `src/pages/Help.tsx` | Real content -- keep |
| `public/robots.txt` | Fine as-is -- keep |
| `src/lib/utils.ts` | Standard `cn()` utility -- keep |
| shadcn/ui components | All in `src/components/ui/` -- keep (they're real dependencies) |

## Technical Details

- **Files deleted:** `src/App.css`, `public/placeholder.svg`, `src/components/NavLink.tsx`
- **Files edited:** `README.md` (full rewrite), `src/App.tsx` (remove one comment line)
- No functional changes to the app
