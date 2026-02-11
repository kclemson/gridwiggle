import { describe, it, expect } from 'vitest';
import { deriveRegionCounts, deriveTargetRowCount, sampleCanvasARValues, sampleAreaFractions } from '@/lib/v3/utils';

describe('deriveRegionCounts', () => {
  it('portrait hero (AR=0.5) on square canvas → large beside region', () => {
    const { besideCount, belowCount } = deriveRegionCounts(0.5, 1.0, 0.20, 20);
    expect(besideCount).toBeGreaterThanOrEqual(8);
    expect(besideCount).toBeLessThanOrEqual(12);
    expect(besideCount + belowCount).toBe(20);
  });

  it('landscape hero (AR=2.0) on square canvas → small beside region', () => {
    const { besideCount, belowCount } = deriveRegionCounts(2.0, 1.0, 0.20, 20);
    expect(besideCount).toBeGreaterThanOrEqual(1);
    expect(besideCount).toBeLessThanOrEqual(5);
    expect(besideCount + belowCount).toBe(20);
  });

  it('portrait hero on wide canvas → even more beside', () => {
    const { besideCount } = deriveRegionCounts(0.5, 1.5, 0.20, 20);
    expect(besideCount).toBeGreaterThanOrEqual(12);
    expect(besideCount).toBeLessThanOrEqual(16);
  });

  it('landscape hero on portrait canvas → nearly all below', () => {
    const { besideCount } = deriveRegionCounts(2.0, 0.7, 0.20, 20);
    expect(besideCount).toBeLessThanOrEqual(4);
  });

  it('square hero on square canvas → moderate split', () => {
    const { besideCount } = deriveRegionCounts(1.0, 1.0, 0.20, 20);
    expect(besideCount).toBeGreaterThanOrEqual(4);
    expect(besideCount).toBeLessThanOrEqual(8);
  });

  it('returns 0/0 for empty content', () => {
    const result = deriveRegionCounts(1.0, 1.0, 0.20, 0);
    expect(result).toEqual({ besideCount: 0, belowCount: 0 });
  });

  it('hero wider than canvas → all below', () => {
    const { besideCount, belowCount } = deriveRegionCounts(3.0, 0.5, 0.50, 10);
    expect(besideCount).toBe(0);
    expect(belowCount).toBe(10);
  });

  it('scales linearly with content count', () => {
    const r20 = deriveRegionCounts(1.0, 1.0, 0.20, 20);
    const r30 = deriveRegionCounts(1.0, 1.0, 0.20, 30);
    const frac20 = r20.besideCount / 20;
    const frac30 = r30.besideCount / 30;
    expect(Math.abs(frac20 - frac30)).toBeLessThan(0.1);
  });
});

describe('deriveTargetRowCount', () => {
  it('returns 0 for 0 photos', () => {
    expect(deriveTargetRowCount(0, 1.0, 1.0, 1.0)).toBe(0);
  });

  it('returns 1 for a single photo', () => {
    expect(deriveTargetRowCount(1, 1.5, 2.0, 1.0)).toBe(1);
  });

  it('narrow tall region → more rows', () => {
    // 6 photos, meanAR=1.2, width=0.15, height=1.0
    // raw = sqrt(6 * 1.2 * 1.0 / 0.15) = sqrt(48) ≈ 6.93 → clamped to ceil(6/2) = 3
    const rows = deriveTargetRowCount(6, 1.2, 0.15, 1.0);
    expect(rows).toBe(3);
  });

  it('wide short region → fewer rows', () => {
    // 6 photos, meanAR=1.2, width=2.0, height=0.3
    // raw = sqrt(6 * 1.2 * 0.3 / 2.0) = sqrt(1.08) ≈ 1.04 → round = 1
    const rows = deriveTargetRowCount(6, 1.2, 2.0, 0.3);
    expect(rows).toBe(1);
  });

  it('clamps to ceil(photoCount/2)', () => {
    // 4 photos, extreme aspect → would want many rows, clamped to 2
    const rows = deriveTargetRowCount(4, 0.5, 0.1, 2.0);
    expect(rows).toBeLessThanOrEqual(2);
  });

  it('handles targetWidth <= 0 gracefully', () => {
    const rows = deriveTargetRowCount(5, 1.0, 0, 1.0);
    expect(rows).toBe(3); // ceil(5/2) = 3
  });

  // Test matrix: verify row counts track region geometry
  it('wider beside region → fewer beside rows', () => {
    // Same photo count, wider region should need fewer rows
    const narrowRows = deriveTargetRowCount(6, 1.2, 0.3, 1.0);
    const wideRows = deriveTargetRowCount(6, 1.2, 1.5, 1.0);
    expect(narrowRows).toBeGreaterThanOrEqual(wideRows);
  });

  it('taller below region → more below rows', () => {
    // Same photo count and width, taller region needs more rows
    const shortRows = deriveTargetRowCount(15, 1.2, 1.5, 0.2);
    const tallRows = deriveTargetRowCount(15, 1.2, 1.5, 0.8);
    expect(tallRows).toBeGreaterThanOrEqual(shortRows);
  });

  it('more photos → more rows for same region shape', () => {
    const fewRows = deriveTargetRowCount(5, 1.2, 1.0, 1.0);
    const manyRows = deriveTargetRowCount(20, 1.2, 1.0, 1.0);
    expect(manyRows).toBeGreaterThanOrEqual(fewRows);
  });
});

describe('sampleCanvasARValues', () => {
  it('returns evenly spaced values', () => {
    const values = sampleCanvasARValues(0.5, 2.0, 4, false);
    expect(values).toHaveLength(4);
    expect(values[0]).toBeCloseTo(0.5);
    expect(values[3]).toBeCloseTo(2.0);
  });

  it('single sample returns midpoint', () => {
    const values = sampleCanvasARValues(0.5, 2.0, 1, false);
    expect(values).toHaveLength(1);
    expect(values[0]).toBeCloseTo(1.25);
  });
});

describe('sampleAreaFractions', () => {
  it('caps area fraction for wide canvas via effectiveMax', () => {
    // effectiveMax for canvasAR 2.0: 0.60 * clamp(1/2, 0.5, 1.0) = 0.30
    const values = sampleAreaFractions(0.15, 0.30, 3);
    expect(values[values.length - 1]).toBeCloseTo(0.30);
  });

  it('uses full max for square canvas', () => {
    // effectiveMax for canvasAR 1.0: 0.60 * 1.0 = 0.60
    const values = sampleAreaFractions(0.15, 0.60, 3);
    expect(values[values.length - 1]).toBeCloseTo(0.60);
  });
});
