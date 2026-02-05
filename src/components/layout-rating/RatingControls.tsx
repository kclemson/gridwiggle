import { useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ThumbsDown, ThumbsUp, SkipForward, ChevronLeft, ChevronRight, Download, Copy } from 'lucide-react';
import { TagCheckboxes } from './TagCheckboxes';
import { LayoutTag, LayoutTestResult } from '@/test/layout/types';

interface RatingControlsProps {
  onRate: (rating: 'good' | 'bad' | 'skip') => void;
  onPrev: () => void;
  onNext: () => void;
  onExport: () => void;
  onCopyStats: () => void;
  canGoPrev: boolean;
  canGoNext: boolean;
  currentIndex: number;
  totalCount: number;
  selectedTags: LayoutTag[];
  onTagsChange: (tags: LayoutTag[]) => void;
  result: LayoutTestResult;
}

/**
 * Rating controls with keyboard shortcuts.
 */
export function RatingControls({
  onRate,
  onPrev,
  onNext,
  onExport,
  onCopyStats,
  canGoPrev,
  canGoNext,
  currentIndex,
  totalCount,
  selectedTags,
  onTagsChange,
  result,
}: RatingControlsProps) {
  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    
    switch (e.key.toLowerCase()) {
      case 'g':
        onRate('good');
        break;
      case 'b':
        onRate('bad');
        break;
      case 's':
        onRate('skip');
        break;
      case 'arrowleft':
        if (canGoPrev) onPrev();
        break;
      case 'arrowright':
        if (canGoNext) onNext();
        break;
    }
  }, [onRate, onPrev, onNext, canGoPrev, canGoNext]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  return (
    <div className="space-y-4">
      {/* Tag checkboxes */}
      <TagCheckboxes selectedTags={selectedTags} onTagsChange={onTagsChange} result={result} />
      
      {/* Main rating buttons */}
      <div className="flex justify-center gap-4">
        <Button
          variant="destructive"
          size="lg"
          onClick={() => onRate('bad')}
          className="min-w-32"
        >
          <ThumbsDown className="mr-2 h-5 w-5" />
          Bad (B)
        </Button>
        
        <Button
          variant="default"
          size="lg"
          onClick={() => onRate('good')}
          className="min-w-32"
        >
          <ThumbsUp className="mr-2 h-5 w-5" />
          Good (G)
        </Button>
        
        <Button
          variant="outline"
          size="lg"
          onClick={() => onRate('skip')}
          className="min-w-24"
        >
          <SkipForward className="mr-2 h-5 w-5" />
          Skip (S)
        </Button>
      </div>
      
      {/* Navigation and export */}
      <div className="flex justify-center items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={!canGoPrev}
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        
        <span className="text-sm text-muted-foreground font-mono">
          {currentIndex + 1} / {totalCount}
        </span>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={!canGoNext}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        <div className="border-l border-border h-6 mx-2" />
        
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
        >
          <Download className="mr-2 h-4 w-4" />
          Export JSON
        </Button>
        
        <Button
          variant="outline"
          size="sm"
          onClick={onCopyStats}
        >
          <Copy className="mr-2 h-4 w-4" />
          Copy Stats
        </Button>
      </div>
      
      {/* Keyboard hints */}
      <div className="text-center text-xs text-muted-foreground">
        Keyboard: G = Good, B = Bad, S = Skip, ← → = Navigate
      </div>
    </div>
  );
}
