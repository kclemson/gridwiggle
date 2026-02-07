
# Make Rejected State Visually Obvious

## Design Intent

When a layout is rejected, you need to know immediately without hunting for it. Currently the rejection badge is tucked below the canvas, far from your eye focus near the shuffle button.

## User Outcome

- **Instant visual feedback** at the point of attention (near the shuffle button)
- **Can't-miss status indicator** that screams "REJECTED" when a layout fails
- **Preserved detail view** - the full rejection badge still shows below canvas for debugging

---

## Visual Changes

### 1. Status Banner in Header (Primary Alert)

Add a prominent status indicator right next to the Shuffle button:

```text
Before (rejected):
┌──────────────────────────────────────────────────────────┐
│  V3 Layout Test          [Show Rejected] [Export] [Shuffle] │
└──────────────────────────────────────────────────────────┘

After (rejected):
┌──────────────────────────────────────────────────────────┐
│  V3 Layout Test    ⚠️ REJECTED: hero too large    [Shuffle] │
│                    └──── pulsing red background ────┘        │
└──────────────────────────────────────────────────────────┘
```

This puts the rejection status exactly where your eye already is.

### 2. Full-Width Flash Banner (Optional - for maximum impact)

Add a colored bar above the canvas that flashes briefly on rejection:

```text
┌──────────────────────────────────────────────────────────┐
│  ⚠️ LAYOUT REJECTED: hero_too_large_vs_smallest_cells    │  ← red background
└──────────────────────────────────────────────────────────┘
│  [Canvas visualization below...]                          │
```

### 3. Canvas Border Color Change

The canvas already has `ring-destructive` on rejection, but it's subtle. Make it:
- Thicker ring (ring-4 instead of ring-2)
- Add a subtle pulsing animation
- Red background tint on the entire card

---

## Technical Approach

### File: `src/pages/V3Test.tsx`

**Add inline status indicator in header:**

```tsx
// In header, after the title but before the buttons
{!layout && rejectedLayout && (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-md animate-pulse">
    <AlertTriangle className="h-4 w-4" />
    <span className="font-medium">REJECTED: {rejectedLayout.reason.replace(/_/g, ' ')}</span>
  </div>
)}
```

**Make the canvas card background red on rejection:**

```tsx
// Change canvas card container
<div className={cn(
  "border rounded-lg p-4 order-1 lg:order-2",
  layout ? "bg-card" : "bg-destructive/5 border-destructive"
)}>
```

**Enhance the ring around rejected layout visualization:**

```tsx
// Change from ring-2 to ring-4 with animation
<div className="ring-4 ring-destructive rounded-lg overflow-hidden animate-pulse">
```

### File: `src/components/debug/RejectionBadge.tsx`

Make the badge more prominent:

```tsx
<div className="mt-3 p-4 bg-destructive/20 border-2 border-destructive rounded-lg">
  <div className="flex items-center gap-2 text-destructive font-bold text-lg">
    <AlertTriangle className="h-5 w-5" />
    REJECTED: {reason.replace(/_/g, ' ')}
  </div>
  ...
</div>
```

---

## Visual Hierarchy

| Element | Purpose | Visibility |
|---------|---------|------------|
| Header status badge | Catch attention immediately | Pulsing red, right where you look |
| Canvas card tint | Indicate problem zone | Subtle red background |
| Canvas ring | Highlight the visualization | Thick red border with pulse |
| Rejection badge | Show detailed metrics | Below canvas for deep debugging |

---

## Files Modified

| File | Change |
|------|--------|
| `src/pages/V3Test.tsx` | Add header status badge, enhance canvas styling on rejection |
| `src/components/debug/RejectionBadge.tsx` | Increase visual prominence |
