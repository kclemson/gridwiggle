import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ThumbsDown, ThumbsUp, SkipForward, ChevronLeft, ChevronRight, Download, RotateCcw } from 'lucide-react';
import { HeroFractionVisualization } from '@/components/hero-fraction/HeroFractionVisualization';
import {
  generateHeroFractionBatch,
  HeroPlacementResult,
  HeroFractionRatingData,
  HERO_FRACTION_TAGS,
  HeroFractionTag,
} from '@/test/layout/heroFractionGenerator';
import { Badge } from '@/components/ui/badge';

const BATCH_SIZE = 40;

export default function HeroFractionRating() {
  const [batch, setBatch] = useState<HeroPlacementResult[]>(() =>
    generateHeroFractionBatch(BATCH_SIZE)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState<Map<number, HeroFractionRatingData>>(new Map());
  const [selectedTags, setSelectedTags] = useState<Set<HeroFractionTag>>(new Set());

  const current = batch[currentIndex];
  const ratedCount = ratings.size;
  const progress = (ratedCount / batch.length) * 100;

  // Restore tags when navigating to a previously-rated trial
  const currentRating = ratings.get(currentIndex)?.rating;
  const currentTags = ratings.get(currentIndex)?.tags;

  // Sync selectedTags when navigating between trials
  useEffect(() => {
    if (currentTags) {
      setSelectedTags(new Set(currentTags as HeroFractionTag[]));
    } else {
      setSelectedTags(new Set());
    }
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTag = useCallback((tag: HeroFractionTag) => {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  }, []);


  const rate = useCallback(
    (rating: 'good' | 'bad' | 'skip') => {
      const result = batch[currentIndex];
      const data: HeroFractionRatingData = {
        canvasAR: result.canvasAR,
        heroCount: result.heroCount,
        heroARs: result.heroARs,
        heroAreaFraction: result.heroAreaFraction,
        actualAreaFraction: result.actualAreaFraction,
        template: result.template,
        rating,
        tags: rating === 'bad' ? Array.from(selectedTags) : [],
        ratedAt: new Date().toISOString(),
      };
      setRatings(prev => new Map(prev).set(currentIndex, data));
      if (rating !== 'bad') setSelectedTags(new Set());
      // Auto-advance
      if (currentIndex < batch.length - 1) {
        setCurrentIndex(i => i + 1);
      }
    },
    [batch, currentIndex, selectedTags],
  );

  const goPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(i => i - 1);
  }, [currentIndex]);

  const goNext = useCallback(() => {
    if (currentIndex < batch.length - 1) setCurrentIndex(i => i + 1);
  }, [currentIndex, batch.length]);

  const exportJSON = useCallback(() => {
    const allRatings = Array.from(ratings.values());
    const summary = {
      goodCount: allRatings.filter(r => r.rating === 'good').length,
      badCount: allRatings.filter(r => r.rating === 'bad').length,
      skipCount: allRatings.filter(r => r.rating === 'skip').length,
    };
    const exportData = {
      sessionId: crypto.randomUUID(),
      totalRated: allRatings.length,
      summary,
      ratings: allRatings,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hero-fraction-ratings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [ratings]);

  const regenerate = useCallback(() => {
    setBatch(generateHeroFractionBatch(BATCH_SIZE));
    setCurrentIndex(0);
    setRatings(new Map());
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key.toLowerCase()) {
        case 'g': rate('good'); break;
        case 'b': rate('bad'); break;
        case 's': rate('skip'); break;
        case 'arrowleft': goPrev(); break;
        case 'arrowright': goNext(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rate, goPrev, goNext]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Hero Area Fraction Rating</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={regenerate}>
              <RotateCcw className="mr-1 h-4 w-4" />
              New Batch
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON} disabled={ratedCount === 0}>
              <Download className="mr-1 h-4 w-4" />
              Export ({ratedCount})
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">
            {ratedCount} / {batch.length} rated
          </p>
        </div>

        {/* Visualization */}
        <Card>
          <CardContent className="p-6">
            {current && <HeroFractionVisualization result={current} />}
          </CardContent>
        </Card>

        {/* Current rating indicator */}
        {currentRating && (
          <p className="text-center text-sm text-muted-foreground">
            Rated: <span className="font-semibold capitalize">{currentRating}</span>
          </p>
        )}

        {/* Rating buttons */}
        <div className="flex justify-center gap-4">
          <Button variant="destructive" size="lg" onClick={() => rate('bad')} className="min-w-28">
            <ThumbsDown className="mr-2 h-5 w-5" />
            Bad (B)
          </Button>
          <Button variant="default" size="lg" onClick={() => rate('good')} className="min-w-28">
            <ThumbsUp className="mr-2 h-5 w-5" />
            Good (G)
          </Button>
          <Button variant="outline" size="lg" onClick={() => rate('skip')} className="min-w-24">
            <SkipForward className="mr-2 h-5 w-5" />
            Skip (S)
          </Button>
        </div>

        {/* Issue tags — always visible, select before rating */}
        <div className="flex flex-wrap justify-center gap-2">
          {HERO_FRACTION_TAGS.map(tag => (
            <Badge
              key={tag}
              variant={selectedTags.has(tag) ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex justify-center items-center gap-4">
          <Button variant="ghost" size="sm" onClick={goPrev} disabled={currentIndex === 0}>
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-sm text-muted-foreground font-mono">
            {currentIndex + 1} / {batch.length}
          </span>
          <Button variant="ghost" size="sm" onClick={goNext} disabled={currentIndex >= batch.length - 1}>
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Keyboard hints */}
        <p className="text-center text-xs text-muted-foreground">
          Select tags first, then G = Good, B = Bad, S = Skip, ← → = Navigate
        </p>
      </div>
    </div>
  );
}
