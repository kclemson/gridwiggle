

# Plan: Improve RejectionBadge Detail Formatting

## The Problem

The current display shows raw JSON for nested objects:
```
belowRowCount: 2 (2-2)
belowConstraints:
{"maxRowsByMinAR":1,"minRowsByMaxAR":2,"minRowsByCellSize":1,"targetWidth":1.6450485237483954}
```

This is hard to read with the quotes and braces.

## The Goal

Display the constraint values inline with `belowRowCount` since they directly inform that value:
```
belowRowCount: 2 (2-2)  [height≤1, width≥2, cell≥1, tw:1.65]
```

---

## Technical Changes

| File | Change |
|------|--------|
| `src/components/debug/RejectionBadge.tsx` | Smart formatting for `belowConstraints` inline with `belowRowCount` |

---

## Approach

Instead of blindly JSON.stringify-ing objects, the component will:

1. **Skip `belowConstraints`** as a separate row
2. **Append constraint info** to the `belowRowCount` row in a compact format

### Proposed Display Format

```
belowRowCount: 2 (2-2)  [h≤1 w≥2 c≥1 tw:1.65]
```

Where:
- `h≤1` = maxRowsByMinAR (height constraint → max rows allowed)
- `w≥2` = minRowsByMaxAR (width constraint → min rows needed)  
- `c≥1` = minRowsByCellSize (cell size constraint → min rows needed)
- `tw:1.65` = targetWidth (the normalized width being packed into)

### Alternative Format (more explicit)

If the abbreviated version is too cryptic:
```
belowRowCount: 2 (2-2)  height≤1 width≥2 cell≥1 tw:1.65
```

---

## Implementation

Update `RejectionBadge.tsx` to:

1. Extract `belowConstraints` from details if present
2. Format other fields normally (no changes)
3. When rendering `belowRowCount`, append the constraint values inline
4. Skip rendering `belowConstraints` as its own row

```tsx
export function RejectionBadge({ reason, details }: RejectionBadgeProps) {
  // Extract belowConstraints for inline display
  const belowConstraints = details.belowConstraints as {
    maxRowsByMinAR: number;
    minRowsByMaxAR: number;
    minRowsByCellSize: number;
    targetWidth: number;
  } | undefined;
  
  // Filter out belowConstraints from main display
  const displayEntries = Object.entries(details).filter(
    ([k]) => k !== 'belowConstraints'
  );
  
  return (
    <div className="mt-3 p-4 bg-destructive/20 border-2 border-destructive rounded-lg">
      <div className="flex items-center gap-2 text-destructive font-bold text-lg">
        <AlertTriangle className="h-5 w-5" />
        REJECTED: {reason.replace(/_/g, ' ')}
      </div>
      <div className="mt-2 text-sm text-destructive/80 font-mono">
        {displayEntries.map(([k, v]) => {
          // Special handling for belowRowCount - append constraints
          if (k === 'belowRowCount' && belowConstraints) {
            const { maxRowsByMinAR, minRowsByMaxAR, minRowsByCellSize, targetWidth } = belowConstraints;
            return (
              <div key={k}>
                {k}: {String(v)}  
                <span className="text-destructive/60 ml-2">
                  [h≤{maxRowsByMinAR} w≥{minRowsByMaxAR} c≥{minRowsByCellSize} tw:{targetWidth.toFixed(2)}]
                </span>
              </div>
            );
          }
          
          // Default: simple string display
          return (
            <div key={k}>
              {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

---

## Expected Result

Before:
```
belowRowCount: 2 (2-2)
belowConstraints:
{"maxRowsByMinAR":1,"minRowsByMaxAR":2,"minRowsByCellSize":1,"targetWidth":1.6450485237483954}
heroAR: 1
```

After:
```
belowRowCount: 2 (2-2)  [h≤1 w≥2 c≥1 tw:1.65]
heroAR: 1
```

The constraint values are now readable and positioned next to the value they inform, making it immediately clear why `2 (2-2)` was chosen: width constraint required ≥2 rows, but height constraint only allowed ≤1 (conflict!).

