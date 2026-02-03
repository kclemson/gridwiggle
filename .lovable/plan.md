

# Remove Unnecessary useEffect from NotFound

The `useEffect` in `NotFound.tsx` is used solely for console logging, which violates our architectural principles - side effects like logging don't need to be deferred to after render.

---

## Current Code

```typescript
useEffect(() => {
  console.error("404 Error: User attempted to access non-existent route:", location.pathname);
}, [location.pathname]);
```

**Problem:** This is unnecessary complexity. Console logging doesn't need to wait for the component to mount - it can happen during render, or we can remove it entirely since:
1. 404s are typically logged server-side in production
2. The browser's network tab already shows failed navigations
3. This adds React overhead for no user benefit

---

## Solution

Remove the `useEffect` and its import entirely. If logging is truly needed, it could happen inline during render, but in this case it's just noise.

---

## File Changes

### `src/pages/NotFound.tsx`

**Remove:**
- `useEffect` import
- The entire `useEffect` block

**Result:** A simpler, purely presentational component with no side effects.

```typescript
import { useLocation } from "react-router-dom";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
```

---

## Summary of All useEffect Cleanups

| File | Status | Action Taken |
|------|--------|--------------|
| `CropEditor.tsx` | Fixed | Removed dimension state + useEffect, use CSS sizing |
| `CollagePreview.tsx` | Fixed | Removed scale state + useEffect, use CSS aspect-ratio |
| `NotFound.tsx` | This PR | Remove logging useEffect entirely |
| `use-mobile.tsx` | Valid | Media query subscription (external API) |
| `use-toast.ts` | Valid | Pub/sub listener (external state) |
| `carousel.tsx` | Valid | Embla library integration |
| `sidebar.tsx` | Valid | Keyboard shortcut listener |

