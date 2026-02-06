

# Improve V3Test Debug Log Readability

## Overview

Two UX improvements to the debug log panel in V3Test.tsx to make logs easier to scan.

---

## Change 1: Wider Log Panel + Category Column Width

**File**: `src/pages/V3Test.tsx`

**Current** (line 135):
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[520px_1fr] gap-6">
```

**Change to**:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-[670px_1fr] gap-6">
```

Also update the log row layout to give more width to the category+label column. Currently each log entry is a flex row with three spans. We'll restructure to use a two-column grid with fixed widths:

**Current** (lines 147-155):
```tsx
<div key={idx} className="flex gap-2">
  <span className="text-blue-500 shrink-0">[{entry.category}]</span>
  <span className="text-foreground">{entry.label}</span>
  {Object.keys(entry.data).length > 0 && (
    <span className="text-muted-foreground break-all">
      {JSON.stringify(entry.data)}
    </span>
  )}
</div>
```

**Change to** (using a grid with fixed first column):
```tsx
<div key={idx} className="grid grid-cols-[180px_1fr] gap-2">
  <div className="flex gap-1 shrink-0">
    <span className="text-blue-500">[{entry.category}]</span>
    <span className="text-foreground whitespace-nowrap">{entry.label}</span>
  </div>
  {Object.keys(entry.data).length > 0 && (
    <span className="text-muted-foreground break-all">
      {formatLogData(entry.data)}
    </span>
  )}
</div>
```

---

## Change 2: Cleaner Data Formatting

**File**: `src/pages/V3Test.tsx`

Add a helper function that:
- Removes `{`, `}`, `"` characters
- Flattens nested objects with `_` prefix
- Outputs comma-separated `key:value` pairs

**Add new function**:
```typescript
/**
 * Format log data for display:
 * - Flatten nested objects with underscore prefix
 * - Remove JSON syntax characters
 * - Format as comma-separated key:value pairs
 */
function formatLogData(data: Record<string, unknown>): string {
  const pairs: string[] = [];
  
  function flatten(obj: Record<string, unknown>, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}_${key}` : key;
      
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively flatten nested objects
        flatten(value as Record<string, unknown>, fullKey);
      } else if (Array.isArray(value)) {
        // Format arrays as [val1, val2, ...]
        const formatted = value.map(v => 
          typeof v === 'number' ? v.toFixed(2) : String(v)
        ).join(', ');
        pairs.push(`${fullKey}:[${formatted}]`);
      } else if (typeof value === 'number') {
        // Format numbers to 2 decimal places if float
        const formatted = Number.isInteger(value) ? value : value.toFixed(2);
        pairs.push(`${fullKey}:${formatted}`);
      } else {
        pairs.push(`${fullKey}:${value}`);
      }
    }
  }
  
  flatten(data);
  return pairs.join(', ');
}
```

**Example transformation**:

Before:
```
{"photoCount":48,"canvasWidth":480,"tuning":{"hero_targetProminence":1.5,"hero_minProminence":1.3}}
```

After:
```
photoCount:48, canvasWidth:480, tuning_hero_targetProminence:1.50, tuning_hero_minProminence:1.30
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/V3Test.tsx` | Widen grid (520px to 670px), add `formatLogData` helper, update log row layout |

