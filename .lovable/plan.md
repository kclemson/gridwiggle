
## Fix: Remove lovable-tagger to Eliminate Console Ref Warnings

### Problem
The `lovable-tagger` plugin (line 4-15 in vite.config.ts) attempts to attach refs to various function components for Lovable's component selection feature. Multiple components don't forward refs, causing a cascade of console warnings:

- `CropEditor`
- `DialogHeader` 
- `DialogFooter`
- `DialogPortal`

### Solution
Remove the `componentTagger` plugin entirely from the Vite configuration. This eliminates all the ref-related console spam.

### File to Modify

**`vite.config.ts`**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// REMOVE: import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()], // REMOVE: mode === "development" && componentTagger()
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
```

### Changes Summary

| Line | Before | After |
|------|--------|-------|
| 4 | `import { componentTagger } from "lovable-tagger";` | (removed) |
| 15 | `plugins: [react(), mode === "development" && componentTagger()].filter(Boolean)` | `plugins: [react()]` |

### What This Fixes
- All "Function components cannot be given refs" warnings will be eliminated
- Console will be clean for debugging the actual crop mismatch issue

### Trade-off
You lose the ability to click on components in the preview to select them in the Lovable editor. This is a minor convenience feature and removing it has no impact on functionality.

### Next Steps (After This Fix)
Once the console is clean, we can return to debugging the actual crop mismatch bug with a clear console.
