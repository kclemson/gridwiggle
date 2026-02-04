
# Move Debug Panel to Left of Collage

## Current State
The debug panel is positioned to the **right** of the collage:
```typescript
style={{ left: 'calc(100% + 24px)', width: '700px' }}
```

## Proposed Change
Move it to the **left** so it doesn't overlap with OS/system/browser notifications that typically appear in the top-right corner:
```typescript
style={{ right: 'calc(100% + 24px)', width: '700px' }}
```

## File Changes

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Line 432: Change `left` to `right` in the debug panel positioning |

## Result
The Hero Layout Logs panel will appear to the left of the collage instead of the right, keeping the notification area clear for screenshots.
