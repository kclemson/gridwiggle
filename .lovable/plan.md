

# Replace Hero Checkbox with Toggle Switch

## What Changes

Replace the Checkbox + Label for "Hero" with a Switch toggle in the CropEditor footer. A switch is the standard UI pattern for binary on/off states and will feel more intuitive than the current checkbox (which visually resembles a radio button).

## Technical Details

**File:** `src/components/CropEditor.tsx`

| Change | Detail |
|--------|--------|
| Import | Replace `Checkbox` import with `Switch` from `@/components/ui/switch` |
| Lines 386-395 | Replace the `Checkbox` + `Label` div with a `Switch` + `Label` using the same state binding |

The Switch component is already installed (`@radix-ui/react-switch`) and available at `@/components/ui/switch`.

The state logic stays identical — `isHero` / `setIsHero` — just the visual control changes.
