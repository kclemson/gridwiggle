import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ThumbsDown, ThumbsUp, SkipForward, ChevronLeft, ChevronRight, Download, RotateCcw } from 'lucide-react';
import { HeroFractionVisualization } from '@/components/hero-fraction/HeroFractionVisualization';
import {
  generateHeroFractionBatch,
  generateRound2Batch,
  HeroPlacementResult,
  HeroFractionRatingData,
  HERO_FRACTION_TAGS,
  HeroFractionTag,
} from '@/test/layout/heroFractionGenerator';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type RoundType = 'round1' | 'round2';

const GENERATORS: Record<RoundType, () => HeroPlacementResult[]> = {
  round1: () => generateHeroFractionBatch(),
  round2: () => generateRound2Batch(),
};

export default function HeroFractionRating() {
  const [round, setRound] = useState<RoundType>('round2');
  const [batch, setBatch] = useState<HeroPlacementResult[]>(() =>
    GENERATORS[round]()
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratings, setRatings] = useState<Map<number, HeroFractionRatingData>>(new Map());
  const [selectedTags, setSelectedTags] = useState<Set<HeroFractionTag>>(new Set());
  const [notes, setNotes] = useState('');

  const current = batch[currentIndex];
  const ratedCount = ratings.size;
  const progress = (ratedCount / batch.length) * 100;

  // Restore tags when navigating to a previously-rated trial
  const currentRating = ratings.get(currentIndex)?.rating;
  const currentTags = ratings.get(currentIndex)?.tags;

  // Sync selectedTags and notes when navigating between trials
  useEffect(() => {
    const saved = ratings.get(currentIndex);
    setSelectedTags(saved?.tags ? new Set(saved.tags as HeroFractionTag[]) : new Set());
    setNotes(saved?.notes ?? '');
  }, [currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const rate = useCallback(
    (rating: 'good' | 'bad' | 'skip', tagsOverride?: Set<HeroFractionTag>) => {
      const tags = tagsOverride ?? selectedTags;
      const result = batch[currentIndex];
      const data: HeroFractionRatingData = {
        canvasAR: result.canvasAR,
        heroCount: result.heroCount,
        heroARs: result.heroARs,
        heroAreaFraction: result.heroAreaFraction,
        actualAreaFraction: result.actualAreaFraction,
        template: result.template,
        scenario: result.scenario,
        rating,
        tags: rating === 'bad' ? Array.from(tags) : [],
        notes: notes || undefined,
        ratedAt: new Date().toISOString(),
      };
      setRatings(prev => new Map(prev).set(currentIndex, data));
      setSelectedTags(new Set());
      setNotes('');
      // Auto-advance
      if (currentIndex < batch.length - 1) {
        setCurrentIndex(i => i + 1);
      }
    },
    [batch, currentIndex, selectedTags, notes],
  );

  const toggleTag = useCallback((tag: HeroFractionTag) => {
    const nextTags = new Set(selectedTags);
    if (nextTags.has(tag)) nextTags.delete(tag); else nextTags.add(tag);
    // Clicking a tag auto-rates as "bad" with that tag
    rate('bad', nextTags);
  }, [selectedTags, rate]);

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
    setBatch(GENERATORS[round]());
    setCurrentIndex(0);
    setRatings(new Map());
  }, [round]);

  const switchRound = useCallback((value: string) => {
    const r = value as RoundType;
    setRound(r);
    setBatch(GENERATORS[r]());
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-foreground">Hero Area Fraction Rating</h1>
            <Select value={round} onValueChange={switchRound}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="round1">Round 1</SelectItem>
                <SelectItem value="round2">Round 2</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

        {/* Optional notes */}
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional notes about this trial..."
          className="max-w-lg mx-auto text-sm"
          rows={2}
        />

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
