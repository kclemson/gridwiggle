

## Update Hero AR Distribution with User-Specified Percentages

### Design Intent
Update the synthetic photo generator to produce heroes with your specified distribution, including very tall portraits that will stress-test the algorithm's handling of extreme portrait cases.

### User Outcome
- V3Test generates heroes matching real-world variety
- Very tall portraits (AR 0.4–0.6) appear 5% of the time to stress-test edge cases
- Square heroes appear 25% of the time to expose the geometric deadlock issue

---

## Distribution

| Hero Type | AR Range | Percentage |
|-----------|----------|------------|
| Very tall portrait | 0.4 – 0.6 | **5%** |
| Portrait | 0.6 – 0.9 | **25%** |
| Square-ish | 0.9 – 1.2 | **25%** |
| Moderate landscape | 1.2 – 1.8 | **35%** |
| Wide panorama | 2.0 – 3.0 | **10%** |

---

## File to Modify

| File | Changes |
|------|---------|
| `src/test/layout/photoGenerator.ts` | Replace hero AR logic (lines 70-80) with weighted category sampling |

---

## Technical Details

Replace the hero AR generation block:

```typescript
if (isHero) {
  // Realistic hero AR distribution
  // 5% very tall portrait, 25% portrait, 25% square-ish,
  // 35% moderate landscape, 10% wide panorama
  const roll = Math.random();
  
  if (roll < 0.05) {
    // 5%: Very tall portrait (tight face crops, vertical products)
    aspectRatio = 0.4 + Math.random() * 0.2;  // AR 0.4 - 0.6
  } else if (roll < 0.30) {
    // 25%: Portrait
    aspectRatio = 0.6 + Math.random() * 0.3;  // AR 0.6 - 0.9
  } else if (roll < 0.55) {
    // 25%: Square-ish
    aspectRatio = 0.9 + Math.random() * 0.3;  // AR 0.9 - 1.2
  } else if (roll < 0.90) {
    // 35%: Moderate landscape
    aspectRatio = 1.2 + Math.random() * 0.6;  // AR 1.2 - 1.8
  } else {
    // 10%: Wide panorama
    aspectRatio = 2.0 + Math.random() * 1.0;  // AR 2.0 - 3.0
  }
}
```

---

## Cumulative Thresholds

| Roll range | Category |
|------------|----------|
| 0.00 – 0.05 | Very tall portrait |
| 0.05 – 0.30 | Portrait |
| 0.30 – 0.55 | Square-ish |
| 0.55 – 0.90 | Moderate landscape |
| 0.90 – 1.00 | Wide panorama |

