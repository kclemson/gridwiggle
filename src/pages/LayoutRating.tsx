import { useState, useEffect, useMemo, useCallback } from 'react';
import { LayoutVisualization } from '@/components/layout-rating/LayoutVisualization';
import { MetricsBadges } from '@/components/layout-rating/MetricsBadges';
import { RatingControls } from '@/components/layout-rating/RatingControls';
import { generateTestBatch, runLayoutTest } from '@/test/layout/layoutAdapter';
import { LayoutTestCase, LayoutTestResult, RatedLayout, RatingSession, LayoutTag } from '@/test/layout/types';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const STORAGE_KEY = 'layout-rating-session';
const BATCH_SIZE = 72; // 9 counts × 4 shapes × 2 hero modes

/**
 * Layout Rating Tool - Dev-only page for rating synthetic layouts.
 */
export default function LayoutRating() {
  // Generate test cases on mount
  const [testCases, setTestCases] = useState<LayoutTestCase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState<RatedLayout[]>([]);
  const [selectedTags, setSelectedTags] = useState<LayoutTag[]>([]);
  
  // Initialize test cases
  useEffect(() => {
    // Try to restore session from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const session = JSON.parse(saved) as { testCases: LayoutTestCase[]; ratings: RatedLayout[]; currentIndex: number };
        setTestCases(session.testCases);
        setRatings(session.ratings);
        setCurrentIndex(session.currentIndex);
        toast.info(`Restored session with ${session.ratings.length} ratings`);
        return;
      } catch (e) {
        console.error('Failed to restore session:', e);
      }
    }
    
    // Generate fresh batch
    const cases = generateTestBatch(BATCH_SIZE);
    setTestCases(cases);
  }, []);
  
  // Save session to localStorage when state changes
  useEffect(() => {
    if (testCases.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        testCases,
        ratings,
        currentIndex,
      }));
    }
  }, [testCases, ratings, currentIndex]);
  
  // Current test result
  const currentResult = useMemo<LayoutTestResult | null>(() => {
    if (testCases.length === 0 || currentIndex >= testCases.length) return null;
    return runLayoutTest(testCases[currentIndex]);
  }, [testCases, currentIndex]);
  
  // Rating handlers
  const handleRate = useCallback((rating: 'good' | 'bad' | 'skip') => {
    if (!currentResult) return;
    
    const ratedLayout: RatedLayout = {
      photoCount: currentResult.testCase.photos.length,
      distribution: currentResult.testCase.distribution,
      shape: currentResult.testCase.shape,
      hasHero: currentResult.testCase.hasHero,
      rowCount: currentResult.rowCount,
      rowSizes: currentResult.rowSizes,
      canvasAspect: currentResult.canvasAspect,
      areaCoefficientOfVariation: currentResult.areaCoefficientOfVariation,
      largestToSmallestRatio: currentResult.largestToSmallestRatio,
      heroCoverage: currentResult.heroCoverage,
      rating,
      tags: selectedTags,
      ratedAt: new Date().toISOString(),
    };
    
    setRatings(prev => {
      // Replace if already rated at this index
      const existing = prev.findIndex((_, i) => i === currentIndex);
      if (existing !== -1 && existing < prev.length) {
        const updated = [...prev];
        updated[currentIndex] = ratedLayout;
        return updated;
      }
      return [...prev, ratedLayout];
    });
    
    // Clear tags and auto-advance
    setSelectedTags([]);
    if (currentIndex < testCases.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
    
    toast.success(`Rated as ${rating}`, { duration: 500 });
  }, [currentResult, currentIndex, testCases.length, selectedTags]);
  
  const handlePrev = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);
  
  const handleNext = useCallback(() => {
    setCurrentIndex(prev => Math.min(testCases.length - 1, prev + 1));
  }, [testCases.length]);
  
  const handleExport = useCallback(() => {
    const session: RatingSession = {
      sessionId: new Date().toISOString(),
      totalRated: ratings.length,
      ratings,
      summary: {
        goodCount: ratings.filter(r => r.rating === 'good').length,
        badCount: ratings.filter(r => r.rating === 'bad').length,
        skipCount: ratings.filter(r => r.rating === 'skip').length,
      },
    };
    
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `layout-ratings-${session.sessionId.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success('Exported ratings JSON');
  }, [ratings]);
  
  const handleCopyStats = useCallback(() => {
    const stats = {
      total: ratings.length,
      good: ratings.filter(r => r.rating === 'good').length,
      bad: ratings.filter(r => r.rating === 'bad').length,
      skip: ratings.filter(r => r.rating === 'skip').length,
    };
    
    navigator.clipboard.writeText(JSON.stringify(stats, null, 2));
    toast.success('Copied stats to clipboard');
  }, [ratings]);
  
  const handleReset = useCallback(() => {
    if (confirm('Reset session and generate new test cases?')) {
      localStorage.removeItem(STORAGE_KEY);
      setTestCases(generateTestBatch(BATCH_SIZE));
      setRatings([]);
      setCurrentIndex(0);
      toast.info('Session reset');
    }
  }, []);
  
  // Progress
  const ratedCount = ratings.filter(r => r.rating !== undefined).length;
  const progress = testCases.length > 0 ? (ratedCount / testCases.length) * 100 : 0;
  
  if (!currentResult) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading test cases...</div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Layout Rating Tool</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {ratedCount} rated
            </span>
            <button
              onClick={handleReset}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Reset
            </button>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>
        
        {/* Layout visualization */}
        <div className="bg-card rounded-lg p-4 border">
          <LayoutVisualization
            layout={currentResult.layout}
            photos={currentResult.testCase.photos}
          />
        </div>
        
        {/* Metrics */}
        <MetricsBadges result={currentResult} />
        
        {/* Rating controls */}
        <RatingControls
          onRate={handleRate}
          onPrev={handlePrev}
          onNext={handleNext}
          onExport={handleExport}
          onCopyStats={handleCopyStats}
          canGoPrev={currentIndex > 0}
          canGoNext={currentIndex < testCases.length - 1}
          currentIndex={currentIndex}
          totalCount={testCases.length}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
        />
        
        {/* Summary stats */}
        <div className="flex justify-center gap-8 text-sm text-muted-foreground">
          <span className="text-primary">
            Good: {ratings.filter(r => r.rating === 'good').length}
          </span>
          <span className="text-destructive">
            Bad: {ratings.filter(r => r.rating === 'bad').length}
          </span>
          <span>
            Skip: {ratings.filter(r => r.rating === 'skip').length}
          </span>
        </div>
      </div>
    </div>
  );
}
