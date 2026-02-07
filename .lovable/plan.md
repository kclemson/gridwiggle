

## Update Test Photo Counts and Hero Probability

### Design Intent
Ensure comprehensive test coverage by including:
- Small sets (5, 6) for simpler layout validation
- Missing edge-case values (16, 20, 30) for mathematical diversity
- Focused hero testing (95% hero probability)

### User Outcomes
- V3Test shuffle will occasionally produce very small sets (5-6 photos)
- Better coverage across the full range of realistic photo counts
- Rare no-hero cases (5%) since those layouts are already well-handled

---

### Changes

#### File 1: `src/test/layout/photoGenerator.ts`

**Current (line 11):**
```typescript
export const TEST_PHOTO_COUNTS = [8, 9, 10, 12, 14, 17, 23, 35, 50] as const;
```

**New:**
```typescript
export const TEST_PHOTO_COUNTS = [5, 6, 8, 9, 10, 12, 14, 16, 17, 20, 23, 30, 35, 50] as const;
```

Added values:
| Count | Rationale |
|-------|-----------|
| 5 | Minimum practical set, tests sparse layouts |
| 6 | Small set, 2×3 or 3×2 grid potential |
| 16 | Power of 2, clean factorization |
| 20 | Common real-world set size |
| 30 | Common real-world set size |

---

#### File 2: `src/pages/V3Test.tsx`

**Change 1: Import TEST_PHOTO_COUNTS (add to imports)**
```typescript
import { generatePhotoSet, TEST_PHOTO_COUNTS } from '@/test/layout/photoGenerator';
```

**Change 2: Update generateRandomSet function (lines 83-87)**

Current:
```typescript
const photoCount = Math.floor(Math.random() * 41) + 10; // 10-50
const orientationBias = (Math.random() - 0.5); // -0.5 to +0.5
const hasHero = Math.random() < 0.8; // 80% hero
```

New:
```typescript
const photoCount = TEST_PHOTO_COUNTS[Math.floor(Math.random() * TEST_PHOTO_COUNTS.length)];
const orientationBias = (Math.random() - 0.5); // -0.5 to +0.5
const hasHero = Math.random() < 0.95; // 95% hero - no-hero cases are easier
```

---

### Summary

| Setting | Current | New |
|---------|---------|-----|
| Photo counts | Uniform 10-50 | `[5, 6, 8, 9, 10, 12, 14, 16, 17, 20, 23, 30, 35, 50]` |
| Hero probability | 80% | 95% |

---

### Files Modified

| File | Change |
|------|--------|
| `src/test/layout/photoGenerator.ts` | Expand `TEST_PHOTO_COUNTS` to include 5, 6, 16, 20, 30 |
| `src/pages/V3Test.tsx` | Use `TEST_PHOTO_COUNTS`; increase hero probability to 95% |

