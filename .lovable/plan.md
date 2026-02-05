# Collage Layout Algorithm

## Active Constraints

### maxPhotosPerRow (Implemented)

Row density ceiling based on √n, scaled by shape:
- **Portrait**: `max(4, floor(√n × 0.7))` → many narrow rows
- **Square/Auto**: `max(5-6, round(√n))` → balanced
- **Landscape**: `max(8, ceil(√n × 1.3))` → fewer wide rows

**Enforcement**: `findBestRowSplit` uses `minRows = ceil(n / maxPhotosPerRow)` to force enough rows. `scorePartition` applies a 3.0 penalty weight for exceeding the limit.

### minPhotosPerRow Range (Existing)

Minimum row density floor based on shape:
- **Portrait**: `[2, √n × 0.7]`
- **Square**: `[max(2, √n - 1), √n + 1]`
- **Landscape**: `[√n, √n × 1.5]`
- **Auto**: `[2, max(√n + 2, n/3)]`

---

## Scoring Weights

| Factor | Weight | Purpose |
|--------|--------|---------|
| Direction penalty | 10.0 | Shape enforcement |
| Sparse row penalty | 5.0 | Minimum density |
| Over-max penalty | 3.0 | Maximum density |
| Area CV | 1.0 | Uniform cell sizes |
| Height CV | 0.2 | Uniform row heights |

