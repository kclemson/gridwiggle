

# Hero Template Registry

## Goal

Transform `src/lib/v3/hero-constraints.ts` from documentation-only comments into an exported TypeScript data structure: a lookup table of valid hero placement topologies. Given known hero count and hero ARs, the engine can query "what templates work here?" and get back a narrowed candidate list.

No engine integration yet -- this is the data layer only.

## Design Decisions

- **One corner-anchor entry** with the full canvas AR range (0.50-2.25). The tighter area ceiling on square canvases (0.35 vs 0.60) is expressed as a conditional within the template's area budget, not as a separate registry entry.
- **Hero AR affinity ranges** are included per template. For example, a top-band template works poorly with very tall portrait heroes, so it specifies a hero AR range like 0.6-3.0.
- **Canvas AR variety** is handled upstream by the engine's randomization/enumeration logic, not by the registry itself. The registry just says what's valid.

## Data Model

```text
HeroTemplate {
  id: string                    -- e.g. "corner-anchor", "diagonal-corners"
  heroCount: 1 | 2
  canvasAR: { min, max }        -- what canvas shapes this works on
  heroAreaFraction: { min, max, squareMax? }  -- area budget (squareMax applied when canvas AR 0.85-1.15)
  heroAR: { min, max }          -- what hero aspect ratios work well
  positions: string[]           -- valid hero positions (e.g. ["top-left","top-right","bottom-left","bottom-right"])
  description: string           -- human-readable for debugging
}
```

## Template Registry

```text
+------------------+-------+-------------+------------------+-----------+---------------------------+
| Template ID      | Count | Canvas AR   | Hero Area        | Hero AR   | Notes                     |
+------------------+-------+-------------+------------------+-----------+---------------------------+
| corner-anchor    | 1     | 0.50 - 2.25 | 0.15-0.60        | 0.4 - 3.0 | Universal; squareMax 0.35 |
|                  |       |             | (sq: 0.15-0.35)  |           |                           |
| top-band         | 1     | 0.85 - 1.15 | 0.20 - 0.35      | 0.8 - 3.0 | Landscape-ish heroes      |
| bottom-band      | 1     | 0.85 - 1.15 | 0.20 - 0.35      | 0.8 - 3.0 | Landscape-ish heroes      |
| left-band        | 1     | 0.85 - 1.15 | 0.20 - 0.35      | 0.3 - 1.2 | Portrait-ish heroes       |
| right-band       | 1     | 0.85 - 1.15 | 0.20 - 0.35      | 0.3 - 1.2 | Portrait-ish heroes       |
| diagonal-corners | 2     | 0.50 - 2.25 | 0.22 - 0.42      | 0.4 - 3.0 | Universal dual            |
| side-by-side     | 2     | 1.15 - 2.25 | 0.22 - 0.42      | 0.3 - 1.5 | Landscape canvas only     |
| top-bottom       | 2     | 0.50 - 0.85 | 0.22 - 0.42      | 0.8 - 3.0 | Portrait canvas only      |
+------------------+-------+-------------+------------------+-----------+---------------------------+
```

Hero AR ranges are preliminary estimates based on geometric reasoning (e.g., a top-band hero spans the full width, so landscape-ish heroes fill it naturally while very tall portraits would create an awkwardly thin band). These can be refined through further rating tool testing.

## Lookup Function

```text
findCandidateTemplates(heroCount, heroARs[]) -> HeroTemplate[]

1. Filter by heroCount
2. Filter by heroAR: every hero AR must fall within the template's heroAR range
3. Return matching templates (engine will enumerate canvas ARs within each template's range)
```

For dual heroes, the hero AR filter checks that BOTH hero ARs fall within the template's range. This naturally handles mixed pairs (e.g., one landscape + one portrait hero narrows the candidate list).

## File Changes

| File | Change |
|------|--------|
| `src/lib/v3/hero-constraints.ts` | Replace doc-only comments with exported types, registry array, and `findCandidateTemplates()` function |

The existing documentation comments will be preserved as the file header, with the structured data below them.

## Technical Details

Exports from the file:
- `HeroTemplate` -- TypeScript interface for a registry entry
- `CanvasARRange` -- `{ min: number; max: number }` 
- `HeroAreaRange` -- `{ min: number; max: number; squareMax?: number }`
- `HeroARRange` -- `{ min: number; max: number }`
- `HERO_TEMPLATES` -- the registry array (frozen/readonly)
- `findCandidateTemplates(heroCount: number, heroARs: number[]): HeroTemplate[]` -- the lookup

