import { describe, it, expect } from 'vitest';
import { deriveRegionCounts, sampleCanvasARValues, sampleAreaFractions } from '@/lib/v3/utils';

describe('deriveRegionCounts', () => {
  // Test matrix from the plan: f=0.20, 20 content photos
  // Expected: Hero AR 0.5 → more beside; Hero AR 2.0 → mostly below
  
  it('portrait hero (AR=0.5) on square canvas → large beside region', () => {
    const { besideCount, belowCount } = deriveRegionCounts(0.5, 1.0, 0.20, 20);
    // Expected ~10 beside from the plan matrix
    expect(besideCount).toBeGreaterThanOrEqual(8);
    expect(besideCount).toBeLessThanOrEqual(12);
    expect(besideCount + belowCount).toBe(20);
  });

  it('landscape hero (AR=2.0) on square canvas → small beside region', () => {
    const { besideCount, belowCount } = deriveRegionCounts(2.0, 1.0, 0.20, 20);
    // Expected ~3 beside from the plan matrix
    expect(besideCount).toBeGreaterThanOrEqual(1);
    expect(besideCount).toBeLessThanOrEqual(5);
    expect(besideCount + belowCount).toBe(20);
  });

  it('portrait hero on wide canvas → even more beside', () => {
    const { besideCount } = deriveRegionCounts(0.5, 1.5, 0.20, 20);
    // Expected ~14 beside from the plan matrix
    expect(besideCount).toBeGreaterThanOrEqual(12);
    expect(besideCount).toBeLessThanOrEqual(16);
  });

  it('landscape hero on portrait canvas → nearly all below', () => {
    const { besideCount } = deriveRegionCounts(2.0, 0.7, 0.20, 20);
    expect(besideCount).toBeLessThanOrEqual(4);
  });

  it('square hero on square canvas → moderate split', () => {
    const { besideCount } = deriveRegionCounts(1.0, 1.0, 0.20, 20);
    // Expected ~6 beside from the plan matrix
    expect(besideCount).toBeGreaterThanOrEqual(4);
    expect(besideCount).toBeLessThanOrEqual(8);
  });

  // Edge cases
  it('returns 0/0 for empty content', () => {
    const result = deriveRegionCounts(1.0, 1.0, 0.20, 0);
    expect(result).toEqual({ besideCount: 0, belowCount: 0 });
  });

  it('hero wider than canvas → all below', () => {
    // Very wide hero on narrow canvas
    const { besideCount, belowCount } = deriveRegionCounts(3.0, 0.5, 0.50, 10);
    expect(besideCount).toBe(0);
    expect(belowCount).toBe(10);
  });

  it('scales linearly with content count', () => {
    const r20 = deriveRegionCounts(1.0, 1.0, 0.20, 20);
    const r30 = deriveRegionCounts(1.0, 1.0, 0.20, 30);
    // Fraction should be similar
    const frac20 = r20.besideCount / 20;
    const frac30 = r30.besideCount / 30;
    expect(Math.abs(frac20 - frac30)).toBeLessThan(0.1);
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
  it('applies squareMax for near-square canvas', () => {
    const values = sampleAreaFractions(0.15, 0.60, 0.35, 1.0, 3);
    expect(values[values.length - 1]).toBeLessThanOrEqual(0.35);
  });

  it('uses full max for non-square canvas', () => {
    const values = sampleAreaFractions(0.15, 0.60, 0.35, 1.5, 3);
    expect(values[values.length - 1]).toBeCloseTo(0.60);
  });
});
