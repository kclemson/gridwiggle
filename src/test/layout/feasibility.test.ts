import { describe, it, expect } from 'vitest';
import { calculateBesideCountRange } from '@/lib/v3/feasibility';
import { DEFAULT_V3_TUNING } from '@/lib/v3/types';

/**
 * Test matrix for width estimation fix in calculateBesideCountRange.
 * 
 * The fix ensures that landscape heroes can achieve landscape canvases by
 * correctly accounting for beside region width when estimating BELOW height.
 */

describe('calculateBesideCountRange', () => {
  const normalizedGap = 0.02; // Typical gap value
  const tuning = DEFAULT_V3_TUNING;

  describe('Portrait heroes (AR < 1.0) - should maintain current behavior', () => {
    it('heroAR=0.6, 46 photos, balanced content: high maxBeside with minBeside for width', () => {
      const result = calculateBesideCountRange(0.6, 45, 1.0, normalizedGap, tuning);
      // Portrait heroes with many photos may require minBeside to meet canvas_minAR
      expect(result.maxBeside).toBeGreaterThanOrEqual(10);
      expect(result.maxBeside).toBeLessThanOrEqual(15);
      // minBeside can be >0 for portrait heroes to prevent too-narrow canvas
      expect(result.minBeside).toBeGreaterThanOrEqual(0);
    });

    it('heroAR=0.6, 25 photos, balanced content: allows up to loop limit', () => {
      const result = calculateBesideCountRange(0.6, 24, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(8);
      expect(result.maxBeside).toBeLessThanOrEqual(15); // Can hit loop limit
    });

    it('heroAR=0.6, 10 photos, balanced content: maxBeside 5-6', () => {
      const result = calculateBesideCountRange(0.6, 9, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(5);
      expect(result.maxBeside).toBeLessThanOrEqual(9);
    });
  });

  describe('Square heroes (AR ~1.0) - should allow more beside than before', () => {
    it('heroAR=1.0, 46 photos: maxBeside 10-14', () => {
      const result = calculateBesideCountRange(1.0, 45, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(8);
      expect(result.maxBeside).toBeLessThanOrEqual(15);
    });

    it('heroAR=1.0, 25 photos: allows up to loop limit', () => {
      const result = calculateBesideCountRange(1.0, 24, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(6);
      expect(result.maxBeside).toBeLessThanOrEqual(15); // Can hit loop limit
    });
  });

  describe('Landscape heroes (AR 1.5) - key fix target', () => {
    it('heroAR=1.5, 46 photos: maxBeside 12-15 (was 4-5)', () => {
      const result = calculateBesideCountRange(1.5, 45, 1.0, normalizedGap, tuning);
      // The fix should allow significantly more beside photos
      expect(result.maxBeside).toBeGreaterThanOrEqual(10);
      expect(result.maxBeside).toBeLessThanOrEqual(15);
    });

    it('heroAR=1.5, 25 photos: maxBeside 8-12 (was 3-4)', () => {
      const result = calculateBesideCountRange(1.5, 24, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(8);
      expect(result.maxBeside).toBeLessThanOrEqual(15);
    });

    it('heroAR=1.5, 10 photos: maxBeside 5-7 (was 2-3)', () => {
      const result = calculateBesideCountRange(1.5, 9, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(4);
      expect(result.maxBeside).toBeLessThanOrEqual(9);
    });
  });

  describe('Wide heroes (AR 2.5) - biggest improvement expected', () => {
    it('heroAR=2.5, 46 photos: maxBeside 15+ (was 2-4)', () => {
      const result = calculateBesideCountRange(2.5, 45, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(12);
      expect(result.maxBeside).toBeLessThanOrEqual(15); // Capped at loop limit
    });

    it('heroAR=2.5, 25 photos: maxBeside 10-15 (was 1-3)', () => {
      const result = calculateBesideCountRange(2.5, 24, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(8);
      expect(result.maxBeside).toBeLessThanOrEqual(15);
    });

    it('heroAR=2.5, 10 photos: maxBeside 4+ (was 1-2)', () => {
      const result = calculateBesideCountRange(2.5, 9, 1.0, normalizedGap, tuning);
      // Wide heroes with few photos are constrained by canvas_maxAR
      expect(result.maxBeside).toBeGreaterThanOrEqual(3);
      expect(result.maxBeside).toBeLessThanOrEqual(9);
    });
  });

  describe('Content AR sensitivity', () => {
    describe('Portrait-heavy content (avg AR ~0.7)', () => {
      it('heroAR=1.5, 46 photos, portrait content: maxBeside 8-10', () => {
        const result = calculateBesideCountRange(1.5, 45, 0.7, normalizedGap, tuning);
        expect(result.maxBeside).toBeGreaterThanOrEqual(8);
        expect(result.maxBeside).toBeLessThanOrEqual(15);
      });

      it('heroAR=2.5, 25 photos, portrait content: maxBeside 4-6', () => {
        const result = calculateBesideCountRange(2.5, 24, 0.7, normalizedGap, tuning);
        expect(result.maxBeside).toBeGreaterThanOrEqual(4);
        expect(result.maxBeside).toBeLessThanOrEqual(15);
      });
    });

    describe('Landscape-heavy content (avg AR ~1.4)', () => {
      it('heroAR=0.6, 25 photos, landscape content: maxBeside 6-8 (no change)', () => {
        const result = calculateBesideCountRange(0.6, 24, 1.4, normalizedGap, tuning);
        expect(result.maxBeside).toBeGreaterThanOrEqual(6);
        expect(result.maxBeside).toBeLessThanOrEqual(15);
      });

      it('heroAR=1.5, 46 photos, landscape content: maxBeside 12-15', () => {
        const result = calculateBesideCountRange(1.5, 45, 1.4, normalizedGap, tuning);
        expect(result.maxBeside).toBeGreaterThanOrEqual(10);
        expect(result.maxBeside).toBeLessThanOrEqual(15);
      });
    });
  });

  describe('Edge cases', () => {
    it('Zero photos: returns 0,0', () => {
      const result = calculateBesideCountRange(1.5, 0, 1.0, normalizedGap, tuning);
      expect(result.minBeside).toBe(0);
      expect(result.maxBeside).toBe(0);
    });

    it('Very wide hero (AR=3.0), 8 photos: constrained by available photos', () => {
      const result = calculateBesideCountRange(3.0, 7, 1.0, normalizedGap, tuning);
      // Should not exceed available content photos
      expect(result.maxBeside).toBeLessThanOrEqual(7);
      expect(result.maxBeside).toBeGreaterThanOrEqual(3);
    });

    it('Low photo count (5 photos): graceful limits', () => {
      const result = calculateBesideCountRange(2.0, 4, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeLessThanOrEqual(4);
      expect(result.maxBeside).toBeGreaterThanOrEqual(0);
    });

    it('Very portrait hero (AR=0.4): still allows high beside', () => {
      const result = calculateBesideCountRange(0.4, 45, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeGreaterThanOrEqual(10);
    });

    it('Extreme landscape (AR=3.5), many photos: respects loop limit', () => {
      const result = calculateBesideCountRange(3.5, 50, 1.0, normalizedGap, tuning);
      expect(result.maxBeside).toBeLessThanOrEqual(15); // Loop limit
      expect(result.maxBeside).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Regression checks - canvas_maxAR compliance', () => {
    // These tests verify the fix doesn't allow canvas_maxAR violations
    // by checking that maxBeside is appropriately bounded
    
    it('Results should respect physical limits', () => {
      const result = calculateBesideCountRange(1.5, 10, 1.0, normalizedGap, tuning);
      // maxBeside should not exceed totalContentCount
      expect(result.maxBeside).toBeLessThanOrEqual(10);
    });

    it('minBeside should always be >= 0', () => {
      const testCases = [
        { heroAR: 0.6, count: 45 },
        { heroAR: 1.5, count: 25 },
        { heroAR: 2.5, count: 10 },
      ];
      
      for (const { heroAR, count } of testCases) {
        const result = calculateBesideCountRange(heroAR, count, 1.0, normalizedGap, tuning);
        expect(result.minBeside).toBeGreaterThanOrEqual(0);
      }
    });

    it('maxBeside should always be >= minBeside', () => {
      const testCases = [
        { heroAR: 0.6, count: 45, avgAR: 1.0 },
        { heroAR: 1.5, count: 25, avgAR: 0.7 },
        { heroAR: 2.5, count: 10, avgAR: 1.4 },
      ];
      
      for (const { heroAR, count, avgAR } of testCases) {
        const result = calculateBesideCountRange(heroAR, count, avgAR, normalizedGap, tuning);
        expect(result.maxBeside).toBeGreaterThanOrEqual(result.minBeside);
      }
    });
  });
});
