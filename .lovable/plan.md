

# Tweak Export Log Label

## What changes

The export telemetry line becomes more descriptive:

**Before:**
```
[s:acb82a] Feb-14 8:16pm export 5 photos
```

**After:**
```
[s:acb82a] Feb-14 8:16pm export collage with 5 photos
```

## Technical details

**`supabase/functions/client-logs/index.ts`** -- In `formatTelemetryLog()`, change the `export` case from:
```
return `${prefix} ${ts} export${count}`;
```
to include "collage with N photos" phrasing using the count from `data.count`.

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/client-logs/index.ts` | Update export event label to "export collage with N photos" |

