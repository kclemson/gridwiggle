import { PhotoItem, CollageLayout, CollageCell, CollageSettings, LayoutTuning } from '@/types/collage';
import { getDisplayCrop } from '@/lib/cropUtils';
import { packPhotosIntoRegion, scoreConfiguration, ConfigurationScore, isAspectAcceptable, getAspectBounds } from '@/lib/collageLayout';
import {
  buildHeroUnitBlock,
  buildContentRowsBlock,
  stackBlocks,
  splitPhotosForBlocks,
  shuffleArray as blockShuffleArray,
  type PhotoDimension as BlockPhotoDimension,
  type LayoutBlock,
} from '@/lib/layoutBlocks';

// ============================================================================
// Constants
// ============================================================================

const MIN_DIMENSION = 100;
const BASE_WIDTH = 1200;

/** Maximum scaling tolerance (10% = up to 5% crop per edge, symmetric) */
const SCALE_TOLERANCE = 0.10;

// ============================================================================
// Types
// ============================================================================

interface PhotoDimension {
  id: string;
  width: number;
  height: number;
  aspectRatio: number;
  weight: number;
}

// ============================================================================
// Helpers
// ============================================================================

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getPhotoDimensions(photos: PhotoItem[], weights: Record<string, number>): PhotoDimension[] {
  return photos.map((photo) => {
    const crop = getDisplayCrop(photo);
    const width = crop ? crop.width : photo.originalWidth;
    const height = crop ? crop.height : photo.originalHeight;
    return {
      id: photo.id,
      width,
      height,
      aspectRatio: width / height,
      weight: weights[photo.id] ?? 1,
    };
  });
}

// ============================================================================
// Hero Width Calculation
// ============================================================================

/**
 * Calculate hero width as a fraction of canvas width.
 * Reduced fractions since hero now spans 2 rows (taller).
 * 
 * @deprecated Use calculateOptimalHeroFraction for edge-anchored layouts
 */
function calculateHeroWidthFraction(
  standardCount: number
): number {
  // Base fractions (produces landscape-ish layouts)
  let baseFraction: number;
  if (standardCount <= 4) {
    baseFraction = 0.55;
  } else if (standardCount <= 8) {
    baseFraction = 0.45;
  } else if (standardCount <= 15) {
    baseFraction = 0.40;
  } else {
    baseFraction = 0.35;
  }
  
  return baseFraction;
}

// ============================================================================
// Algebraic Hero Fraction Calculation
// ============================================================================

interface RowAspectInfo {
  aspectSums: number[];    // Aspect sum for each row
  photoCounts: number[];   // Photo count per row
}

/**
 * Calculate aspect sums for each row using the same split logic as packing functions.
 */
function getRowAspectInfo(photos: PhotoDimension[], rowCount: 2 | 3): RowAspectInfo {
  if (rowCount === 2) {
    const midpoint = Math.ceil(photos.length / 2);
    const row1Photos = photos.slice(0, midpoint);
    const row2Photos = photos.slice(midpoint);
    
    return {
      aspectSums: [
        row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
        row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
      ],
      photoCounts: [row1Photos.length, row2Photos.length],
    };
  }
  
  // 3-row split (same logic as packBesideAs3Rows)
  const basePerRow = Math.floor(photos.length / 3);
  const remainder = photos.length % 3;
  
  const row1Count = basePerRow + (remainder >= 1 ? 1 : 0);
  const row2Count = basePerRow + (remainder >= 2 ? 1 : 0);
  const row3Count = basePerRow;
  
  const row1Photos = photos.slice(0, row1Count);
  const row2Photos = photos.slice(row1Count, row1Count + row2Count);
  const row3Photos = photos.slice(row1Count + row2Count);
  
  return {
    aspectSums: [
      row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
      row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
      row3Photos.reduce((sum, p) => sum + p.aspectRatio, 0),
    ],
    photoCounts: [row1Photos.length, row2Photos.length, row3Photos.length],
  };
}

/**
 * Calculate the heroWidthFraction that produces scaleFactor ≈ 1.0
 * given the specific beside photos and hero aspect ratio.
 * 
 * Mathematical derivation (2-row case):
 * 
 * Let B = besideWidth, W = canvasWidth, g = gap, heroAR = hero aspect ratio
 * R1, R2 = row aspect sums, n1, n2 = photos per row
 * 
 * Row heights: h1 = (B - (n1-1)g) / R1, h2 = (B - (n2-1)g) / R2
 * Combined height: H = h1 + g + h2 = B × (1/R1 + 1/R2) + g × (1 - (n1-1)/R1 - (n2-1)/R2)
 * 
 * For perfect fit: heroWidth + g + B = W
 *   → H × heroAR + g + B = W
 *   → B × [heroAR × (1/R1 + 1/R2) + 1] = W - g - g × heroAR × (1 - (n1-1)/R1 - (n2-1)/R2)
 * 
 * Solving for B, then: f = 1 - (B + g) / W
 */
function calculateOptimalHeroFraction(
  heroAspect: number,
  besidePhotos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  rowCount: 2 | 3,
  minFraction: number = 0.30,
  maxFraction: number = 0.60
): { fraction: number; clamped: boolean } {
  const MIN_FRACTION = minFraction;
  const MAX_FRACTION = maxFraction;
  
  const { aspectSums, photoCounts } = getRowAspectInfo(besidePhotos, rowCount);
  
  // Validate we have valid rows
  if (aspectSums.some(s => s <= 0) || photoCounts.some(c => c <= 0)) {
    return { fraction: 0.45, clamped: true }; // Fallback to middle value
  }
  
  // Calculate k1 = heroAR × sum(1/Ri) + 1
  const inverseAspectSum = aspectSums.reduce((sum, R) => sum + 1 / R, 0);
  const k1 = heroAspect * inverseAspectSum + 1;
  
  // Calculate k2 = 1 - sum((ni-1)/Ri) for gap contribution to height
  // This accounts for how gaps between photos in each row affect combined height
  let gapContribution = 1;
  for (let i = 0; i < rowCount; i++) {
    gapContribution -= (photoCounts[i] - 1) / aspectSums[i];
  }
  // Add (rowCount - 1) for gaps between rows
  gapContribution += (rowCount - 1);
  
  // B = (W - g - g × heroAR × k2) / k1
  const numerator = canvasWidth - gap - gap * heroAspect * gapContribution;
  const optimalBesideWidth = numerator / k1;
  
  // f = 1 - (B + g) / W = heroWidthFraction
  const optimalFraction = 1 - (optimalBesideWidth + gap) / canvasWidth;
  
  // Clamp to reasonable range
  const clamped = optimalFraction < MIN_FRACTION || optimalFraction > MAX_FRACTION;
  const clampedFraction = Math.max(MIN_FRACTION, Math.min(MAX_FRACTION, optimalFraction));
  
  return { fraction: clampedFraction, clamped };
}

// ============================================================================
// Multi-Row Beside Packing (Hero Spans 2 or 3 Rows)
// ============================================================================

interface PackResult {
  cells: CollageCell[];
  combinedHeight: number;
  naturalTotalWidth: number;
  usedIds: Set<string>;
}

interface PackResult2Row extends PackResult {
  row1Height: number;
  row2Height: number;
}

/**
 * Pack photos beside the hero into exactly 2 rows.
 * 
 * INDEPENDENT ROW SCALING: Each row fills targetWidth exactly.
 * This eliminates blank rectangles from mismatched row widths.
 * 
 * The hero will span both rows (2× height of individual photos).
 */
function packBesideAs2Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): PackResult2Row {
  if (photos.length < 2) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set(), row1Height: 0, row2Height: 0 };
  }

  // Split photos roughly evenly between 2 rows
  const midpoint = Math.ceil(photos.length / 2);
  const row1Photos = photos.slice(0, midpoint);
  const row2Photos = photos.slice(midpoint);

  if (row2Photos.length === 0) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set(), row1Height: 0, row2Height: 0 };
  }

  // Calculate height for each row to fill targetWidth exactly
  const row1AspectSum = row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row2AspectSum = row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0);

  const row1Gaps = gap * Math.max(0, row1Photos.length - 1);
  const row2Gaps = gap * Math.max(0, row2Photos.length - 1);

  // FIXED: Each row height calculated to fill targetWidth exactly
  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;

  const combinedHeight = row1Height + gap + row2Height;

  // Build cells - each row fills targetWidth exactly (no blank rectangles)
  const cells: CollageCell[] = [];
  let x = offsetX;

  // Row 1 - fills targetWidth
  for (const photo of row1Photos) {
    const photoWidth = row1Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: 0,
      width: Math.round(photoWidth),
      height: Math.round(row1Height),
    });
    x += photoWidth + gap;
  }

  // Row 2 - fills targetWidth independently
  x = offsetX;
  for (const photo of row2Photos) {
    const photoWidth = row2Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(row1Height + gap),
      width: Math.round(photoWidth),
      height: Math.round(row2Height),
    });
    x += photoWidth + gap;
  }

  return {
    cells,
    combinedHeight,
    naturalTotalWidth: targetWidth, // Both rows fill targetWidth exactly
    usedIds: new Set([...row1Photos, ...row2Photos].map(p => p.id)),
    row1Height,
    row2Height,
  };
}

interface PackResult3Row extends PackResult {
  row1Height: number;
  row2Height: number;
  row3Height: number;
}

/**
 * Pack photos beside the hero into exactly 3 rows.
 * 
 * INDEPENDENT ROW SCALING: Each row fills targetWidth exactly.
 * This gives the algorithm more flexibility for larger photosets.
 * 
 * The hero will span all 3 rows (3× height of individual photos).
 */
function packBesideAs3Rows(
  photos: PhotoDimension[],
  targetWidth: number,
  gap: number,
  offsetX: number
): PackResult3Row {
  if (photos.length < 3) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set(), row1Height: 0, row2Height: 0, row3Height: 0 };
  }

  // IMPROVED: Better splitting for uneven counts
  // For 5 photos: [2, 2, 1], for 7: [3, 2, 2], for 9: [3, 3, 3]
  const basePerRow = Math.floor(photos.length / 3);
  const remainder = photos.length % 3;
  
  const row1Count = basePerRow + (remainder >= 1 ? 1 : 0);
  const row2Count = basePerRow + (remainder >= 2 ? 1 : 0);
  const row3Count = basePerRow;
  
  const row1Photos = photos.slice(0, row1Count);
  const row2Photos = photos.slice(row1Count, row1Count + row2Count);
  const row3Photos = photos.slice(row1Count + row2Count);

  // Ensure each row has at least 1 photo
  if (row1Photos.length === 0 || row2Photos.length === 0 || row3Photos.length === 0) {
    return { cells: [], combinedHeight: 0, naturalTotalWidth: 0, usedIds: new Set(), row1Height: 0, row2Height: 0, row3Height: 0 };
  }

  // Calculate height for each row to fill targetWidth exactly
  const row1AspectSum = row1Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row2AspectSum = row2Photos.reduce((sum, p) => sum + p.aspectRatio, 0);
  const row3AspectSum = row3Photos.reduce((sum, p) => sum + p.aspectRatio, 0);

  const row1Gaps = gap * Math.max(0, row1Photos.length - 1);
  const row2Gaps = gap * Math.max(0, row2Photos.length - 1);
  const row3Gaps = gap * Math.max(0, row3Photos.length - 1);

  const row1Height = (targetWidth - row1Gaps) / row1AspectSum;
  const row2Height = (targetWidth - row2Gaps) / row2AspectSum;
  const row3Height = (targetWidth - row3Gaps) / row3AspectSum;

  const combinedHeight = row1Height + gap + row2Height + gap + row3Height;

  // Build cells - each row fills targetWidth exactly
  const cells: CollageCell[] = [];
  let x = offsetX;
  let y = 0;

  // Row 1
  for (const photo of row1Photos) {
    const photoWidth = row1Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(photoWidth),
      height: Math.round(row1Height),
    });
    x += photoWidth + gap;
  }

  // Row 2
  x = offsetX;
  y = row1Height + gap;
  for (const photo of row2Photos) {
    const photoWidth = row2Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(photoWidth),
      height: Math.round(row2Height),
    });
    x += photoWidth + gap;
  }

  // Row 3
  x = offsetX;
  y = row1Height + gap + row2Height + gap;
  for (const photo of row3Photos) {
    const photoWidth = row3Height * photo.aspectRatio;
    cells.push({
      photoId: photo.id,
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(photoWidth),
      height: Math.round(row3Height),
    });
    x += photoWidth + gap;
  }

  return {
    cells,
    combinedHeight,
    naturalTotalWidth: targetWidth, // All rows fill targetWidth exactly
    usedIds: new Set([...row1Photos, ...row2Photos, ...row3Photos].map(p => p.id)),
    row1Height,
    row2Height,
    row3Height,
  };
}

/**
 * Fallback: Pack photos as a single row (for few photos or when 2-row doesn't fit).
 * Uses tolerance-based scaling to fill available width.
 */
function packBesideAs1Row(
  photos: PhotoDimension[],
  targetHeight: number,
  availableWidth: number,
  gap: number,
  offsetX: number
): { cells: CollageCell[]; usedIds: Set<string> } {
  if (photos.length === 0 || availableWidth < MIN_DIMENSION) {
    return { cells: [], usedIds: new Set() };
  }

  // Calculate natural widths at target height
  const naturalWidths = photos.map(p => targetHeight * p.aspectRatio);
  const gapsTotal = gap * Math.max(0, photos.length - 1);
  const naturalTotalWidth = naturalWidths.reduce((a, b) => a + b, 0) + gapsTotal;

  // Check if within tolerance
  const scaleFactor = availableWidth / naturalTotalWidth;
  
  if (scaleFactor < (1 - SCALE_TOLERANCE) || scaleFactor > (1 + SCALE_TOLERANCE)) {
    // Outside tolerance - can't pack all photos
    // Try with fewer photos
    if (photos.length > 1) {
      return packBesideAs1Row(photos.slice(0, -1), targetHeight, availableWidth, gap, offsetX);
    }
    return { cells: [], usedIds: new Set() };
  }

  // Scale widths to fit exactly
  const cells: CollageCell[] = [];
  let x = offsetX;

  for (let i = 0; i < photos.length; i++) {
    const scaledWidth = naturalWidths[i] * scaleFactor;
    cells.push({
      photoId: photos[i].id,
      x: Math.round(x),
      y: 0,
      width: Math.round(scaledWidth),
      height: Math.round(targetHeight),
    });
    x += scaledWidth + gap;
  }

  return {
    cells,
    usedIds: new Set(photos.map(p => p.id)),
  };
}

// ============================================================================
// Zone Packing Functions
// ============================================================================

/**
 * Pack photos into full-width rows (for below zone).
 */
function packRowsFullWidth(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  offsetY: number
): CollageCell[] {
  if (photos.length === 0) return [];

  const result = packPhotosIntoRegion(photos, {
    width: canvasWidth,
    gap,
    offsetX: 0,
    offsetY,
  });

  return result.cells;
}

// ============================================================================
// Edge-Anchored Hero Layout (Row-Based)
// ============================================================================

/**
 * Fix row alignment after scaling to eliminate bottom gaps.
 * Forces each row's Y position to align perfectly with hero bottom.
 */
function fixRowAlignment2Row(
  cells: CollageCell[],
  row1Height: number,
  row2Height: number,
  scaledHeroHeight: number,
  scaleFactor: number,
  gap: number
): CollageCell[] {
  const scaledRow1Height = Math.round(row1Height * scaleFactor);
  const scaledRow2Height = Math.round(row2Height * scaleFactor);
  
  // Force row 2 to align with hero bottom (eliminates rounding gaps)
  const correctRow2Y = scaledHeroHeight - scaledRow2Height;
  
  // Threshold to identify row 2 cells (original Y was row1Height + gap)
  const row2Threshold = Math.round((row1Height + gap) * scaleFactor) - 5;
  
  return cells.map(cell => {
    if (cell.y >= row2Threshold) {
      // This is a row 2 cell - fix alignment
      return {
        ...cell,
        y: correctRow2Y,
        height: scaledRow2Height,
      };
    }
    // Row 1 cell - ensure consistent height
    return {
      ...cell,
      y: 0,
      height: scaledRow1Height,
    };
  });
}

/**
 * Fix row alignment after scaling for 3-row layouts.
 * Forces each row's Y position to align perfectly.
 */
function fixRowAlignment3Row(
  cells: CollageCell[],
  row1Height: number,
  row2Height: number,
  row3Height: number,
  scaledHeroHeight: number,
  scaleFactor: number,
  gap: number
): CollageCell[] {
  const scaledRow1Height = Math.round(row1Height * scaleFactor);
  const scaledRow2Height = Math.round(row2Height * scaleFactor);
  const scaledRow3Height = Math.round(row3Height * scaleFactor);
  
  // Calculate correct Y positions for each row
  const row1Y = 0;
  const row2Y = scaledRow1Height + gap;
  const row3Y = scaledHeroHeight - scaledRow3Height; // Align with bottom
  
  // Thresholds to identify rows
  const row2Start = Math.round((row1Height + gap) * scaleFactor) - 5;
  const row3Start = Math.round((row1Height + gap + row2Height + gap) * scaleFactor) - 5;
  
  return cells.map(cell => {
    if (cell.y >= row3Start) {
      // Row 3 cell - align with hero bottom
      return { ...cell, y: row3Y, height: scaledRow3Height };
    } else if (cell.y >= row2Start) {
      // Row 2 cell
      return { ...cell, y: row2Y, height: scaledRow2Height };
    }
    // Row 1 cell
    return { ...cell, y: row1Y, height: scaledRow1Height };
  });
}

/**
 * Candidate for hero layout scoring.
 */
interface HeroCandidate {
  layout: CollageLayout;
  score: ConfigurationScore;
  scaleFactor: number;
}

/**
 * Generate layout with edge-anchored hero using 2-row or 3-row beside packing.
 * 
 * FEATURES:
 * 1. Intro rows option: 30% chance hero appears below some full-width rows
 * 2. Explicit row alignment: Eliminates bottom gaps from rounding errors
 * 3. 3-row trigger: Relaxed tolerance (±20%) for 3-row layouts
 * 4. Hero spans 2-3 rows (2-3× height of individual photos)
 * 5. SHAPE-AWARE: Collects candidates and picks best based on shape compliance
 */
function generateEdgeAnchoredHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  shape: CollageSettings['shape'] = 'auto'
): CollageLayout {
  const shuffled = randomize ? shuffleArray(standards) : standards;
  
  // Determine anchor side
  const anchorRight = randomize ? Math.random() < 0.5 : false;
  
  // NEW: Sometimes place intro rows before hero zone (50% chance)
  const useIntroRows = randomize && standards.length >= 8 && Math.random() < 0.5;
  const introRowCount = useIntroRows ? Math.min(2, Math.floor(standards.length / 6)) : 0;
  const photosPerIntroRow = 3;
  
  // Split photos: intro rows → beside zone → below zone
  const introPhotos = shuffled.slice(0, introRowCount * photosPerIntroRow);
  const remainingPhotos = shuffled.slice(introRowCount * photosPerIntroRow);
  
  // Pack intro rows first
  let currentY = 0;
  let introCells: CollageCell[] = [];
  if (introPhotos.length > 0) {
    const introResult = packPhotosIntoRegion(introPhotos, {
      width: canvasWidth,
      gap,
      offsetX: 0,
      offsetY: 0,
    });
    introCells = introResult.cells;
    if (introCells.length > 0) {
      currentY = Math.max(...introCells.map(c => c.y + c.height)) + gap;
    }
  }

  // For < 4 remaining standards, fall back to 1-row mode
  if (remainingPhotos.length < 4) {
    const fallbackLayout = generateEdgeAnchoredHeroLayout1Row(hero, remainingPhotos, canvasWidth, gap, anchorRight, shape);
    // Offset all cells by currentY and add intro cells
    const offsetCells = fallbackLayout.cells.map(cell => ({ ...cell, y: cell.y + currentY }));
    return {
      width: canvasWidth,
      height: Math.round(currentY + fallbackLayout.height),
      cells: [...introCells, ...offsetCells],
    };
  }

  // Collect candidates and score them
  const candidates: HeroCandidate[] = [];

  // ADAPTIVE APPROACH: Try 3-row first for large sets, then 2-row
  // Now using ALGEBRAIC FRACTION CALCULATION per configuration
  
  // Try 3-row packing for larger photosets (8+ photos)
  if (remainingPhotos.length >= 8) {
    for (let besideCount = Math.min(12, remainingPhotos.length); besideCount >= 3; besideCount--) {
      const besidePhotos = remainingPhotos.slice(0, besideCount);
      
      // Need at least 3 photos for valid 3-row split
      if (besidePhotos.length < 3) continue;
      
      // ALGEBRAIC: Calculate optimal fraction for THESE specific photos
      const { fraction: optimalFraction, clamped } = calculateOptimalHeroFraction(
        hero.aspectRatio,
        besidePhotos,
        canvasWidth,
        gap,
        3
      );
      
      const targetBesideWidth = Math.round(canvasWidth * (1 - optimalFraction)) - gap;
      const packResult = packBesideAs3Rows(besidePhotos, targetBesideWidth, gap, 0);
      
      if (packResult.combinedHeight === 0) continue;
      
      // UNIFIED SCALING: Hero height = beside combined height (3 rows)
      const heroHeight = packResult.combinedHeight;
      const heroWidth = heroHeight * hero.aspectRatio;
      
      // Calculate actual scale factor (should be ≈1.0 unless clamped)
      const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
      const scaleFactor = canvasWidth / totalNaturalWidth;
      
      // When using algebraic fraction, we accept a wider range (clamping already applied)
      const accepted = scaleFactor >= 0.75 && scaleFactor <= 1.25;
      
      if (!accepted) {
        continue; // Try fewer photos
      }
      
      // HORIZONTAL-ONLY SCALING for beside cells
      const scaledHeroWidth = Math.round(heroWidth * scaleFactor);
      const scaledHeroHeight = Math.round(heroHeight * scaleFactor);
      const availableBesideWidth = canvasWidth - scaledHeroWidth - gap;
      const horizontalScale = availableBesideWidth / packResult.naturalTotalWidth;

      // Position hero (with currentY offset for intro rows)
      const heroX = anchorRight ? canvasWidth - scaledHeroWidth : 0;
      const heroCell: CollageCell = {
        photoId: hero.id,
        x: heroX,
        y: currentY,
        width: scaledHeroWidth,
        height: scaledHeroHeight,
      };

      // Scale beside cells (horizontal + uniform vertical)
      const besideOffsetX = anchorRight ? 0 : scaledHeroWidth + gap;
      let adjustedBesideCells = packResult.cells.map(cell => ({
        ...cell,
        x: Math.round(besideOffsetX + (cell.x * horizontalScale)),
        y: Math.round(cell.y * scaleFactor),
        width: Math.round(cell.width * horizontalScale),
        height: Math.round(cell.height * scaleFactor),
      }));
      
      // FIXED: Apply row alignment fix to eliminate bottom gaps
      adjustedBesideCells = fixRowAlignment3Row(
        adjustedBesideCells,
        packResult.row1Height,
        packResult.row2Height,
        packResult.row3Height,
        scaledHeroHeight,
        scaleFactor,
        gap
      );
      
      // Add currentY offset for intro rows
      adjustedBesideCells = adjustedBesideCells.map(cell => ({ ...cell, y: cell.y + currentY }));

      // Pack below zone with remaining photos
      const belowPhotos = remainingPhotos.slice(besideCount);
      const belowY = currentY + scaledHeroHeight + gap;
      const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

      // Assemble layout
      const allCells = [...introCells, heroCell, ...adjustedBesideCells, ...belowCells];
      const finalHeight = allCells.length > 0
        ? Math.max(...allCells.map(c => c.y + c.height))
        : currentY + scaledHeroHeight;

      const candidateLayout: CollageLayout = {
        width: canvasWidth,
        height: Math.round(finalHeight),
        cells: allCells,
      };
      
      // Score this candidate
      const score = scoreConfiguration(candidateLayout, {
        shape,
        hasHero: true,
        scaleFactor,
        minPhotosPerRow: 2,
      });
      
      candidates.push({ layout: candidateLayout, score, scaleFactor });
    }
  }

  // Try 2-row packing (4+ photos)
  for (let besideCount = Math.min(6, remainingPhotos.length); besideCount >= 4; besideCount--) {
    const besidePhotos = remainingPhotos.slice(0, besideCount);
    
    // ALGEBRAIC: Calculate optimal fraction for THESE specific photos
    const { fraction: optimalFraction, clamped } = calculateOptimalHeroFraction(
      hero.aspectRatio,
      besidePhotos,
      canvasWidth,
      gap,
      2
    );
    
    const targetBesideWidth = Math.round(canvasWidth * (1 - optimalFraction)) - gap;
    
    // Pack beside photos into 2 rows (get their natural dimensions)
    const packResult = packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0);
    
    if (packResult.combinedHeight === 0) continue;
    
    // UNIFIED SCALING: Hero height = beside combined height (2 rows)
    const heroHeight = packResult.combinedHeight;
    const heroWidth = heroHeight * hero.aspectRatio;
    
    // Calculate actual scale factor (should be ≈1.0 unless clamped)
    const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
    const scaleFactor = canvasWidth / totalNaturalWidth;
    
    // When using algebraic fraction, we accept a wider range (clamping already applied)
    const accepted = scaleFactor >= 0.75 && scaleFactor <= 1.25;
    
    if (!accepted) {
      continue; // Try fewer photos
    }
    
    // HORIZONTAL-ONLY SCALING for beside cells
    const scaledHeroWidth = Math.round(heroWidth * scaleFactor);
    const scaledHeroHeight = Math.round(heroHeight * scaleFactor);
    const availableBesideWidth = canvasWidth - scaledHeroWidth - gap;
    const horizontalScale = availableBesideWidth / packResult.naturalTotalWidth;

    // Position hero (with currentY offset for intro rows)
    const heroX = anchorRight ? canvasWidth - scaledHeroWidth : 0;
    const heroCell: CollageCell = {
      photoId: hero.id,
      x: heroX,
      y: currentY,
      width: scaledHeroWidth,
      height: scaledHeroHeight,
    };

    // Scale beside cells (horizontal + uniform vertical)
    const besideOffsetX = anchorRight ? 0 : scaledHeroWidth + gap;
    let adjustedBesideCells = packResult.cells.map(cell => ({
      ...cell,
      x: Math.round(besideOffsetX + (cell.x * horizontalScale)),
      y: Math.round(cell.y * scaleFactor),
      width: Math.round(cell.width * horizontalScale),
      height: Math.round(cell.height * scaleFactor),
    }));
    
    // FIXED: Apply row alignment fix to eliminate bottom gaps
    adjustedBesideCells = fixRowAlignment2Row(
      adjustedBesideCells,
      packResult.row1Height,
      packResult.row2Height,
      scaledHeroHeight,
      scaleFactor,
      gap
    );
    
    // Add currentY offset for intro rows
    adjustedBesideCells = adjustedBesideCells.map(cell => ({ ...cell, y: cell.y + currentY }));

    // Pack below zone with remaining photos
    const belowPhotos = remainingPhotos.slice(besideCount);
    const belowY = currentY + scaledHeroHeight + gap;
    const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

    // Assemble layout
    const allCells = [...introCells, heroCell, ...adjustedBesideCells, ...belowCells];
    const finalHeight = allCells.length > 0
      ? Math.max(...allCells.map(c => c.y + c.height))
      : currentY + scaledHeroHeight;

    const candidateLayout: CollageLayout = {
      width: canvasWidth,
      height: Math.round(finalHeight),
      cells: allCells,
    };
    
    // Score this candidate
    const score = scoreConfiguration(candidateLayout, {
      shape,
      hasHero: true,
      scaleFactor,
      minPhotosPerRow: 2,
    });
    
    candidates.push({ layout: candidateLayout, score, scaleFactor });
  }

  // Pick best candidate based on score with aspect bound filtering
  if (candidates.length > 0) {
    // PHASE 1: Filter to only aspect-acceptable candidates
    const acceptableCandidates = candidates.filter(c => {
      const aspect = c.layout.width / c.layout.height;
      return isAspectAcceptable(aspect, shape);
    });
    
    // Use acceptable candidates if any exist, otherwise fall back to best aspect match
    const candidatePool = acceptableCandidates.length > 0 
      ? acceptableCandidates 
      : candidates; // Graceful fallback: pick closest aspect
    
    candidatePool.sort((a, b) => {
      // If using fallback (no acceptable), sort by aspect deviation first
      if (acceptableCandidates.length === 0) {
        const [minA, maxA] = getAspectBounds(shape);
        const targetAspect = (minA + maxA) / 2;
        const aDeviation = Math.abs(a.layout.width / a.layout.height - targetAspect);
        const bDeviation = Math.abs(b.layout.width / b.layout.height - targetAspect);
        if (Math.abs(aDeviation - bDeviation) > 0.01) return aDeviation - bDeviation;
      }
      // Primary: direction penalty (shape compliance)
      if (a.score.directionPenalty !== b.score.directionPenalty) {
        return a.score.directionPenalty - b.score.directionPenalty;
      }
      // Secondary: scale factor closeness to 1.0
      return Math.abs(a.scaleFactor - 1.0) - Math.abs(b.scaleFactor - 1.0);
    });
    return candidatePool[0].layout;
  }

  // No working multi-row config found - fallback to 1-row
  const fallbackLayout = generateEdgeAnchoredHeroLayout1Row(hero, remainingPhotos, canvasWidth, gap, anchorRight, shape);
  const offsetCells = fallbackLayout.cells.map(cell => ({ ...cell, y: cell.y + currentY }));
  return {
    width: canvasWidth,
    height: Math.round(currentY + fallbackLayout.height),
    cells: [...introCells, ...offsetCells],
  };
}

/**
 * Dedicated layout for hero + 0-3 standard photos.
 * 
 * Uses simple proportional width allocation to guarantee a 2-column layout
 * (hero + companion side-by-side). Avoids the complex tolerance-based packing
 * that often fails with very few photos, causing "wasted space" (side gaps).
 * 
 * Layout patterns:
 * - 0 standards: Solo hero full-width
 * - 1 standard: [2] - hero + photo side-by-side
 * - 2 standards: [2,1] - hero + photo side-by-side, 1 full-width below
 * - 3 standards: [2,2] - hero + photo side-by-side, 2 full-width below
 */
function generateTinyHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  anchorRight: boolean
): CollageLayout {
  if (standards.length === 0) {
    // Solo hero - full width
    const heroHeight = canvasWidth / hero.aspectRatio;
    return {
      width: canvasWidth,
      height: Math.round(heroHeight),
      cells: [{
        photoId: hero.id,
        x: 0,
        y: 0,
        width: canvasWidth,
        height: Math.round(heroHeight),
      }],
    };
  }

  const companion = standards[0];
  const remaining = standards.slice(1);

  // Proportional width: each gets width based on its aspect ratio share
  // This ensures both photos have the same height
  const availableWidth = canvasWidth - gap;
  const combinedAspect = hero.aspectRatio + companion.aspectRatio;
  
  const heroWidth = Math.round(availableWidth * (hero.aspectRatio / combinedAspect));
  const companionWidth = canvasWidth - heroWidth - gap;
  
  // Shared height (both columns same height by construction)
  const sharedHeight = heroWidth / hero.aspectRatio;

  // Position hero and companion
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: anchorRight ? canvasWidth - heroWidth : 0,
    y: 0,
    width: heroWidth,
    height: Math.round(sharedHeight),
  };

  const companionCell: CollageCell = {
    photoId: companion.id,
    x: anchorRight ? 0 : heroWidth + gap,
    y: 0,
    width: companionWidth,
    height: Math.round(sharedHeight),
  };

  // Pack remaining photos below as full-width rows
  const belowY = Math.round(sharedHeight) + gap;
  const belowCells = packRowsFullWidth(remaining, canvasWidth, gap, belowY);

  const allCells = [heroCell, companionCell, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : sharedHeight;

  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

/**
 * 1-row fallback for edge-anchored hero (few photos).
 * Now shape-aware for future scoring integration.
 */
function generateEdgeAnchoredHeroLayout1Row(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  anchorRight: boolean,
  _shape: CollageSettings['shape'] = 'auto' // Accept shape for API consistency
): CollageLayout {
  // ============================================
  // EARLY EXIT: Very small sets (0-3 standards)
  // Use dedicated simple layout to avoid wasted space
  // ============================================
  if (standards.length <= 3) {
    return generateTinyHeroLayout(hero, standards, canvasWidth, gap, anchorRight);
  }

  const widthFraction = calculateHeroWidthFraction(standards.length);
  const heroWidth = Math.round(canvasWidth * widthFraction);
  const heroHeight = heroWidth / hero.aspectRatio;

  const availableBesideWidth = canvasWidth - heroWidth - gap;
  const besideStartX = anchorRight ? 0 : heroWidth + gap;
  
  const { cells: besideCells, usedIds } = packBesideAs1Row(
    standards,
    heroHeight,
    availableBesideWidth,
    gap,
    besideStartX
  );

  const belowPhotos = standards.filter(p => !usedIds.has(p.id));

  const heroX = anchorRight ? canvasWidth - heroWidth : 0;
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: 0,
    width: heroWidth,
    height: Math.round(heroHeight),
  };

  const belowY = Math.round(heroHeight) + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

  const allCells = [heroCell, ...besideCells, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : heroHeight;

  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

// ============================================================================
// Floating Hero Layout (2-Row, for Many Photos)
// ============================================================================

/**
 * Generate layout with floating hero using 2-row packing on both sides.
 * 
 * For many photos, hero is positioned between left and right zones.
 * Each side uses 2-row packing, hero spans the combined height.
 * 
 * Now shape-aware: falls back to edge-anchored which uses scoring.
 */
function generateFloatingHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  shape: CollageSettings['shape'] = 'auto'
): CollageLayout {
  const shuffled = randomize ? shuffleArray(standards) : standards;
  
  // NEW: Sometimes place intro rows before hero zone (50% chance for large sets)
  const useIntroRows = randomize && standards.length >= 12 && Math.random() < 0.5;
  const introRowCount = useIntroRows ? Math.min(2, Math.floor(standards.length / 8)) : 0;
  const photosPerIntroRow = 4;
  
  // Split photos: intro rows → beside zone → below zone
  const introPhotos = shuffled.slice(0, introRowCount * photosPerIntroRow);
  const remainingPhotos = shuffled.slice(introRowCount * photosPerIntroRow);
  
  // Pack intro rows first
  let currentY = 0;
  let introCells: CollageCell[] = [];
  if (introPhotos.length > 0) {
    const introResult = packPhotosIntoRegion(introPhotos, {
      width: canvasWidth,
      gap,
      offsetX: 0,
      offsetY: 0,
    });
    introCells = introResult.cells;
    if (introCells.length > 0) {
      currentY = Math.max(...introCells.map(c => c.y + c.height)) + gap;
    }
  }
  
  // Split remaining: ~30% left, ~30% right, rest below
  const leftCount = Math.min(6, Math.ceil(remainingPhotos.length * 0.3));
  const rightCount = Math.min(6, Math.ceil(remainingPhotos.length * 0.3));
  
  const leftCandidates = remainingPhotos.slice(0, leftCount);
  const rightCandidates = remainingPhotos.slice(leftCount, leftCount + rightCount);
  const initialBelowPhotos = remainingPhotos.slice(leftCount + rightCount);

  // Target width fraction for hero
  const widthFraction = calculateHeroWidthFraction(standards.length);
  const targetHeroWidth = Math.round(canvasWidth * widthFraction);
  const targetSideWidth = Math.floor((canvasWidth - targetHeroWidth - 2 * gap) / 2);

  // NEW: Pack left side - try 3-row for many photos, then 2-row
  let leftResult: PackResult2Row | PackResult3Row;
  if (leftCandidates.length >= 6) {
    const result3 = packBesideAs3Rows(leftCandidates, targetSideWidth, gap, 0);
    if (result3.combinedHeight > 0) {
      leftResult = result3;
    } else {
      leftResult = packBesideAs2Rows(leftCandidates, targetSideWidth, gap, 0);
    }
  } else {
    leftResult = packBesideAs2Rows(leftCandidates, targetSideWidth, gap, 0);
  }
  
  // NEW: Pack right side - try 3-row for many photos, then 2-row
  let rightResult: PackResult2Row | PackResult3Row;
  if (rightCandidates.length >= 6) {
    const result3 = packBesideAs3Rows(rightCandidates, targetSideWidth, gap, 0);
    if (result3.combinedHeight > 0) {
      rightResult = result3;
    } else {
      rightResult = packBesideAs2Rows(rightCandidates, targetSideWidth, gap, 0);
    }
  } else {
    rightResult = packBesideAs2Rows(rightCandidates, targetSideWidth, gap, 0);
  }

  // Use the taller side to determine hero height
  const maxSideHeight = Math.max(
    leftResult.combinedHeight || 0,
    rightResult.combinedHeight || 0
  );

  if (maxSideHeight === 0) {
    // Fallback if neither side could be packed
    return generateEdgeAnchoredHeroLayout(hero, standards, canvasWidth, gap, randomize, shape);
  }

  // UNIFIED SCALING: Hero height = side combined height (shared by construction)
  const heroHeight = maxSideHeight;
  const heroWidth = heroHeight * hero.aspectRatio;
  
  // Calculate natural widths using the actual packed widths
  const leftNaturalWidth = leftResult.naturalTotalWidth || 0;
  const rightNaturalWidth = rightResult.naturalTotalWidth || 0;
  const totalNaturalWidth = leftNaturalWidth + (leftNaturalWidth > 0 ? gap : 0) + 
                            heroWidth + 
                            (rightNaturalWidth > 0 ? gap : 0) + rightNaturalWidth;
  
  const scaleFactor = canvasWidth / totalNaturalWidth;
  
  const accepted = scaleFactor >= 0.80 && scaleFactor <= 1.20;
  
  // RELAXED: ±20% tolerance for floating layout with 3-row options
  if (!accepted) {
    // Outside tolerance - fall back to edge-anchored
    return generateEdgeAnchoredHeroLayout(hero, standards, canvasWidth, gap, randomize, shape);
  }

  // Apply unified scale factor
  const scaledHeroWidth = Math.round(heroWidth * scaleFactor);
  const scaledHeroHeight = Math.round(heroHeight * scaleFactor);
  const scaledLeftWidth = Math.round(leftNaturalWidth * scaleFactor);
  const scaledRightWidth = Math.round(rightNaturalWidth * scaleFactor);
  
  // Position hero (centered between scaled sides)
  const heroX = leftNaturalWidth > 0 ? scaledLeftWidth + gap : 0;
  
  const heroCell: CollageCell = {
    photoId: hero.id,
    x: heroX,
    y: currentY,
    width: scaledHeroWidth,
    height: scaledHeroHeight,
  };

  // Scale left cells with horizontal-only scaling within their zone
  const leftHorizontalScale = leftNaturalWidth > 0 ? scaledLeftWidth / leftNaturalWidth : 1;
  let leftCells = leftResult.cells.map(cell => ({
    ...cell,
    x: Math.round(cell.x * leftHorizontalScale),
    y: Math.round(cell.y * scaleFactor),
    width: Math.round(cell.width * leftHorizontalScale),
    height: Math.round(cell.height * scaleFactor),
  }));

  // NEW: Apply row alignment fix to left cells
  if ('row3Height' in leftResult && leftResult.row3Height > 0) {
    leftCells = fixRowAlignment3Row(
      leftCells,
      leftResult.row1Height,
      leftResult.row2Height,
      leftResult.row3Height,
      scaledHeroHeight,
      scaleFactor,
      gap
    );
  } else if ('row2Height' in leftResult && leftResult.row2Height > 0) {
    leftCells = fixRowAlignment2Row(
      leftCells,
      leftResult.row1Height,
      leftResult.row2Height,
      scaledHeroHeight,
      scaleFactor,
      gap
    );
  }
  
  // Add currentY offset to left cells
  leftCells = leftCells.map(cell => ({ ...cell, y: cell.y + currentY }));

  // Scale right cells with horizontal-only scaling within their zone
  const rightStartX = heroX + scaledHeroWidth + gap;
  const rightHorizontalScale = rightNaturalWidth > 0 ? scaledRightWidth / rightNaturalWidth : 1;
  let rightCells = rightResult.cells.map(cell => ({
    ...cell,
    x: rightStartX + Math.round(cell.x * rightHorizontalScale),
    y: Math.round(cell.y * scaleFactor),
    width: Math.round(cell.width * rightHorizontalScale),
    height: Math.round(cell.height * scaleFactor),
  }));

  // NEW: Apply row alignment fix to right cells (need to recalculate without rightStartX first)
  if ('row3Height' in rightResult && rightResult.row3Height > 0) {
    // Create temporary cells without X offset for alignment fix
    let tempRightCells = rightResult.cells.map(cell => ({
      ...cell,
      x: Math.round(cell.x * rightHorizontalScale),
      y: Math.round(cell.y * scaleFactor),
      width: Math.round(cell.width * rightHorizontalScale),
      height: Math.round(cell.height * scaleFactor),
    }));
    tempRightCells = fixRowAlignment3Row(
      tempRightCells,
      rightResult.row1Height,
      rightResult.row2Height,
      rightResult.row3Height,
      scaledHeroHeight,
      scaleFactor,
      gap
    );
    // Re-apply rightStartX offset
    rightCells = tempRightCells.map(cell => ({ ...cell, x: cell.x + rightStartX }));
  } else if ('row2Height' in rightResult && rightResult.row2Height > 0) {
    let tempRightCells = rightResult.cells.map(cell => ({
      ...cell,
      x: Math.round(cell.x * rightHorizontalScale),
      y: Math.round(cell.y * scaleFactor),
      width: Math.round(cell.width * rightHorizontalScale),
      height: Math.round(cell.height * scaleFactor),
    }));
    tempRightCells = fixRowAlignment2Row(
      tempRightCells,
      rightResult.row1Height,
      rightResult.row2Height,
      scaledHeroHeight,
      scaleFactor,
      gap
    );
    rightCells = tempRightCells.map(cell => ({ ...cell, x: cell.x + rightStartX }));
  }
  
  // Add currentY offset to right cells
  rightCells = rightCells.map(cell => ({ ...cell, y: cell.y + currentY }));

  // Collect unused photos for below zone
  const belowPhotos = [
    ...leftCandidates.filter(p => !leftResult.usedIds.has(p.id)),
    ...rightCandidates.filter(p => !rightResult.usedIds.has(p.id)),
    ...initialBelowPhotos,
  ];

  // Pack below zone
  const belowY = currentY + scaledHeroHeight + gap;
  const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, belowY);

  // Assemble all cells
  const allCells = [...introCells, ...leftCells, heroCell, ...rightCells, ...belowCells];
  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : scaledHeroHeight;

  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

// ============================================================================
// Block-Based Layout Generator (New Architecture)
// ============================================================================

/**
 * Generate layout using the block-based architecture.
 * 
 * Algorithm:
 * 1. Build hero unit block (consumes hero + N beside photos)
 * 2. Split remaining photos into content row blocks
 * 3. Shuffle blocks for variety (if randomize=true)
 * 4. Stack and return
 * 
 * Benefits:
 * - Hero can appear anywhere (top, middle, bottom)
 * - No single photo can dominate by being in the "below zone"
 * - Infinite visual variety through block shuffling
 */
function generateBlockBasedHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto'
): CollageLayout | null {
  // Shuffle candidates if randomizing
  const candidates = randomize ? shuffleArray(standards) : standards;
  
  // Wrapper to inject tuning into calculateOptimalHeroFraction
  const calculateOptimalHeroFractionWithTuning = (
    heroAspect: number,
    besidePhotos: PhotoDimension[],
    cw: number,
    g: number,
    rowCount: 2 | 3
  ) => calculateOptimalHeroFraction(
    heroAspect, besidePhotos, cw, g, rowCount,
    tuning.heroMinFraction, tuning.heroMaxFraction
  );
  
  // 1. Build hero unit block
  const heroBlock = buildHeroUnitBlock(
    hero as BlockPhotoDimension,
    candidates as BlockPhotoDimension[],
    canvasWidth,
    gap,
    packBesideAs2Rows,
    packBesideAs3Rows,
    calculateOptimalHeroFractionWithTuning,
    fixRowAlignment2Row,
    fixRowAlignment3Row,
    { 
      anchorSide: randomize ? 'random' : 'left',
      maxBeside3Row: tuning.maxBeside3Row,
      maxBeside2Row: tuning.maxBeside2Row,
      threeRowThreshold: tuning.threeRowThreshold,
      scaleToleranceLow: tuning.scaleToleranceLow,
      scaleToleranceHigh: tuning.scaleToleranceHigh,
      maxBesideFraction: tuning.maxBesideFraction,
      totalPhotoCount: standards.length + 1, // +1 for hero
      minContentPhotos: tuning.minContentPhotos,
    }
  );
  
  if (!heroBlock) {
    return null;
  }
  
  // 2. Get remaining photos (not used in hero block)
  const remaining = candidates.filter(p => !heroBlock.photoIds.has(p.id));
  
  // 3. Build ONE content block with ALL remaining photos
  // This allows shape-aware scoring to optimize the entire set
  const contentBlock = remaining.length > 0
    ? buildContentRowsBlock(
      remaining as BlockPhotoDimension[],
      canvasWidth,
      gap,
      packPhotosIntoRegion,
      tuning.minPhotosPerRow,
      shape
    )
    : null;
  
  const contentBlocks: LayoutBlock[] = contentBlock ? [contentBlock] : [];
  
  // 4. Combine all blocks
  let allBlocks: LayoutBlock[] = [heroBlock, ...contentBlocks];
  
  // 5. Shuffle if randomizing (hero can end up anywhere!)
  if (randomize && allBlocks.length > 1) {
    allBlocks = blockShuffleArray(allBlocks);
  }
  
  // 6. Stack blocks vertically
  const layout = stackBlocks(allBlocks, canvasWidth, gap);
  
  // Find hero position for logging
  const heroIndex = allBlocks.findIndex(b => b.type === 'hero-unit');
  const heroPosition = heroIndex === 0 ? 'top' : 
                       heroIndex === allBlocks.length - 1 ? 'bottom' : 'middle';
  
  return layout;
}

// ============================================================================
// Main Entry Points
// ============================================================================

// Thresholds for adaptive strategy based on photo count
const FEW_PHOTOS_THRESHOLD = 8;
const BLOCK_BASED_MIN_PHOTOS = 6; // Minimum photos to try block-based approach

/**
 * Generate layout for a single hero photo.
 * Uses block-based architecture for variety, with fallbacks.
 */
function generateSingleHeroLayout(
  hero: PhotoDimension,
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto'
): CollageLayout {
  // Try block-based layout for larger photosets (provides shuffled variety)
  if (standards.length >= BLOCK_BASED_MIN_PHOTOS) {
    const blockLayout = generateBlockBasedHeroLayout(
      hero, standards, canvasWidth, gap, randomize, tuning, shape
    );
    
    if (blockLayout) {
      return blockLayout;
    }
  }
  
  // Fallback to legacy strategies
  const strategy = standards.length < FEW_PHOTOS_THRESHOLD ? 'edge-anchored' : 'floating';
  
  // Use edge-anchored layout for few photos (simpler, cleaner)
  if (standards.length < FEW_PHOTOS_THRESHOLD) {
    return generateEdgeAnchoredHeroLayout(
      hero, standards, canvasWidth, gap, randomize, shape
    );
  }

  // Use floating layout for many photos (more variety)
  return generateFloatingHeroLayout(
    hero, standards, canvasWidth, gap, randomize, shape
  );
}

/**
 * Handle multiple heroes by processing them sequentially.
 * Each hero uses 2-row beside packing.
 */
function generateMultiHeroLayout(
  heroes: PhotoDimension[],
  standards: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto'
): CollageLayout {
  const orderedHeroes = randomize ? shuffleArray([...heroes]) : heroes;

  // Distribute standards among heroes proportionally
  const standardsPerHero = Math.ceil(standards.length / heroes.length);
  const shuffledStandards = randomize ? shuffleArray(standards) : standards;

  const allCells: CollageCell[] = [];
  let currentY = 0;

  for (let i = 0; i < orderedHeroes.length; i++) {
    const hero = orderedHeroes[i];
    const isLast = i === orderedHeroes.length - 1;

    // Get this hero's share of standards
    const startIdx = i * standardsPerHero;
    const endIdx = isLast ? standards.length : startIdx + standardsPerHero;
    const heroStandards = shuffledStandards.slice(startIdx, endIdx);

    // Determine anchor side (alternating)
    const anchorRight = randomize ? Math.random() < 0.5 : (i % 2 === 1);

    // Try 2-row packing with iterative approach if we have enough photos
    if (heroStandards.length >= 4) {
      const widthFraction = calculateHeroWidthFraction(heroStandards.length);
      const targetBesideWidth = Math.round(canvasWidth * (1 - widthFraction)) - gap;
      
      // Iterative approach: try different beside counts
      let found2RowConfig = false;
      for (let besideCount = Math.min(6, heroStandards.length); besideCount >= 4; besideCount--) {
        const besidePhotos = heroStandards.slice(0, besideCount);
        
        const packResult = packBesideAs2Rows(besidePhotos, targetBesideWidth, gap, 0);
        
        if (packResult.combinedHeight === 0) continue;

        // UNIFIED SCALING: Hero height = beside combined height
        const heroHeight = packResult.combinedHeight;
        const heroWidth = heroHeight * hero.aspectRatio;
        const totalNaturalWidth = heroWidth + gap + packResult.naturalTotalWidth;
        const scaleFactor = canvasWidth / totalNaturalWidth;

        if (scaleFactor >= 0.85 && scaleFactor <= 1.15) {
          // Horizontal-only scaling for beside cells
          const scaledHeroWidth = Math.round(heroWidth * scaleFactor);
          const scaledHeroHeight = Math.round(heroHeight * scaleFactor);
          const availableBesideWidth = canvasWidth - scaledHeroWidth - gap;
          const horizontalScale = availableBesideWidth / packResult.naturalTotalWidth;
          
          const heroX = anchorRight ? canvasWidth - scaledHeroWidth : 0;
          const besideOffsetX = anchorRight ? 0 : scaledHeroWidth + gap;

          // Add hero
          allCells.push({
            photoId: hero.id,
            x: heroX,
            y: currentY,
            width: scaledHeroWidth,
            height: scaledHeroHeight,
          });

          // Add beside cells with horizontal-only scaling
          const adjustedBesideCells = packResult.cells.map(cell => ({
            ...cell,
            x: Math.round(besideOffsetX + (cell.x * horizontalScale)),
            y: currentY + Math.round(cell.y * scaleFactor),
            width: Math.round(cell.width * horizontalScale),
            height: Math.round(cell.height * scaleFactor),
          }));
          allCells.push(...adjustedBesideCells);

          currentY += scaledHeroHeight + gap;

          // Pack remaining photos below
          const belowPhotos = heroStandards.slice(besideCount);
          if (belowPhotos.length > 0) {
            const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, currentY);
            allCells.push(...belowCells);
            if (belowCells.length > 0) {
              currentY = Math.max(...belowCells.map(c => c.y + c.height)) + gap;
            }
          }
          found2RowConfig = true;
          break; // Found working config, move to next hero
        }
      }
      
      if (found2RowConfig) continue; // Next hero
    }

    // Fallback to 1-row for this hero
    const widthFraction = calculateHeroWidthFraction(heroStandards.length);
    const heroWidth = Math.round(canvasWidth * widthFraction);
    const heroHeight = heroWidth / hero.aspectRatio;

    const availableBesideWidth = canvasWidth - heroWidth - gap;
    const besideStartX = anchorRight ? 0 : heroWidth + gap;
    
    const { cells: besideCells, usedIds } = packBesideAs1Row(
      heroStandards,
      heroHeight,
      availableBesideWidth,
      gap,
      besideStartX
    );

    const heroX = anchorRight ? canvasWidth - heroWidth : 0;

    allCells.push({
      photoId: hero.id,
      x: heroX,
      y: currentY,
      width: heroWidth,
      height: Math.round(heroHeight),
    });

    const adjustedBesideCells = besideCells.map(cell => ({
      ...cell,
      y: currentY,
    }));
    allCells.push(...adjustedBesideCells);

    currentY += Math.round(heroHeight) + gap;

    // Pack below for this hero
    const belowPhotos = heroStandards.filter(p => !usedIds.has(p.id));
    if (belowPhotos.length > 0) {
      const belowCells = packRowsFullWidth(belowPhotos, canvasWidth, gap, currentY);
      allCells.push(...belowCells);
      if (belowCells.length > 0) {
        currentY = Math.max(...belowCells.map(c => c.y + c.height)) + gap;
      }
    }
  }

  const finalHeight = allCells.length > 0
    ? Math.max(...allCells.map(c => c.y + c.height))
    : 800;

  return {
    width: canvasWidth,
    height: Math.round(finalHeight),
    cells: allCells,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate a content-only layout (no heroes) using block primitives.
 * This uses the same buildContentRowsBlock as hero layouts for consistency.
 */
function generateContentOnlyLayout(
  photos: PhotoDimension[],
  canvasWidth: number,
  gap: number,
  randomize: boolean,
  tuning: LayoutTuning,
  shape: 'auto' | 'landscape' | 'portrait' | 'square' = 'auto'
): CollageLayout {
  if (photos.length === 0) {
    return { width: canvasWidth, height: 800, cells: [] };
  }
  
  // Shuffle photos when randomizing for variety
  const workingPhotos = randomize ? shuffleArray(photos) : photos;
  
  // Convert to BlockPhotoDimension type for buildContentRowsBlock
  const blockPhotos: BlockPhotoDimension[] = workingPhotos.map(p => ({
    id: p.id,
    width: p.width,
    height: p.height,
    aspectRatio: p.aspectRatio,
    weight: p.weight,
  }));
  
  // Build content rows using the same block primitive as hero layouts
  const contentBlock = buildContentRowsBlock(
    blockPhotos,
    canvasWidth,
    gap,
    packPhotosIntoRegion,
    tuning.minPhotosPerRow,
    shape
  );
  
  if (!contentBlock) {
    return { width: canvasWidth, height: 800, cells: [] };
  }
  
  return {
    width: canvasWidth,
    height: contentBlock.height,
    cells: contentBlock.cells,
  };
}

export function generateHeroLayout(
  photos: PhotoItem[],
  settings: CollageSettings,
  weights: Record<string, number>,
  randomize: boolean,
  tuning: LayoutTuning
): CollageLayout {
  const gap = settings.gapSize;

  const dims = getPhotoDimensions(photos, weights);
  const heroes = dims.filter(d => d.weight >= 2.0);
  const standards = dims.filter(d => d.weight < 2.0);

  // Route based on hero count
  if (heroes.length === 0) {
    // No heroes: use content-only layout (same block primitive as hero layouts)
    return generateContentOnlyLayout(standards, BASE_WIDTH, gap, randomize, tuning, settings.shape);
  }

  if (heroes.length === 1) {
    return generateSingleHeroLayout(
      heroes[0],
      standards,
      BASE_WIDTH,
      gap,
      randomize,
      tuning,
      settings.shape
    );
  }

  return generateMultiHeroLayout(
    heroes,
    standards,
    BASE_WIDTH,
    gap,
    randomize,
    settings.shape
  );
}

/**
 * Check if a photo set has heroes that should use hero layout
 */
export function hasHeroPhotos(photos: PhotoItem[], weights: Record<string, number>): boolean {
  const dims = getPhotoDimensions(photos, weights);
  const heroes = dims.filter(d => d.weight >= 2.0);
  const standards = dims.filter(d => d.weight < 2.0);

  // Need at least one hero AND at least one standard
  return heroes.length > 0 && standards.length > 0;
}
