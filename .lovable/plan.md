

# Clean Up Remaining V3 References

Update comments and strings that still reference "V3" to reflect the current engine naming.

## Changes

### 1. `src/pages/Index.tsx` (line 174)
- Change comment `// Always use V3 worker for layout generation` to `// Use worker for layout generation`

### 2. `src/pages/LayoutTest.tsx`
- Update docstring (lines 1-6): "V3 Layout Test Page" / "rapid V3 algorithm iteration" to "Layout Test Page" / "rapid layout algorithm iteration"
- Update export filename (line 394): `v3-captures-${timestamp}.json` to `layout-captures-${timestamp}.json`

### 3. `src/lib/captureStorage.ts` (lines 1-5)
- Update docstring: "V3 Layout Capture Storage" / "V3 layout generation metadata" to "Layout Capture Storage" / "layout generation metadata"

### 4. `src/components/debug/CaptureControls.tsx` (line 5)
- Change `Used by both V3Test header and DebugPanel` to `Used by both LayoutTest header and DebugPanel`

### 5. `src/components/debug/DebugLogPanel.tsx` (line 5)
- Change `Used by both V3Test and main app DebugPanel` to `Used by both LayoutTest and main app DebugPanel`

### 6. `src/components/debug/RejectionBadge.tsx` (line 5)
- Change `Used in V3Test to visualize` to `Used in LayoutTest to visualize`

### 7. `src/components/DebugPanel.tsx` (line 58)
- Change comment `// Export photo ARs to clipboard for V3Test import` to `// Export photo ARs to clipboard for LayoutTest import`

All changes are comment/string-only -- no logic changes, no risk of breakage.

