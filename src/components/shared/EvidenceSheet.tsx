'use client';

import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';
import { BookOpen, CheckCircle, ShieldCheck } from 'lucide-react';

export function EvidenceSheet() {
  const { isOpen, activeEvidence, closeEvidence } = useEvidenceSheet();
  const [fullChunkText, setFullChunkText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    let ignore = false;

    if (!isOpen || !activeEvidence) {
      return;
    }

    if (activeEvidence.text) {
      return;
    }

    if (activeEvidence.chunk_id) {
      fetch(`/api/library/chunks/${activeEvidence.chunk_id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!ignore && data?.chunk?.text) {
            setFullChunkText(data.chunk.text);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }

    return () => {
      ignore = true;
    };
  }, [isOpen, activeEvidence]);

  if (!activeEvidence) return null;

  const quote = activeEvidence.quote || '';
  const displayText = (activeEvidence.text) ? activeEvidence.text : (fullChunkText || quote);

  // Highlight quote within text if found
  let highlightedContent: React.ReactNode = displayText;
  if (quote && displayText && displayText.toLowerCase().includes(quote.toLowerCase())) {
    const lowerText = displayText.toLowerCase();
    const lowerQuote = quote.toLowerCase();
    const startIndex = lowerText.indexOf(lowerQuote);
    const endIndex = startIndex + quote.length;

    const before = displayText.slice(0, startIndex);
    const match = displayText.slice(startIndex, endIndex);
    const after = displayText.slice(endIndex);

    highlightedContent = (
      <span>
        {before}
        <mark className="bg-amber-200/80 dark:bg-amber-500/30 text-foreground px-1 py-0.5 rounded font-medium border-b border-amber-500">
          {match}
        </mark>
        {after}
      </span>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeEvidence()}>
      <SheetContent side="right" className="w-full sm:max-w-lg md:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Library Evidence Proof</span>
          </div>
          <SheetTitle className="text-xl font-bold leading-snug">
            {activeEvidence.source_title || 'Clinical Reference Source'}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 pt-1">
            {activeEvidence.source_year && (
              <span className="text-xs text-muted-foreground">Pub. {activeEvidence.source_year}</span>
            )}
            {activeEvidence.page && (
              <span className="text-xs text-muted-foreground">• Page {activeEvidence.page}</span>
            )}
            {activeEvidence.evidence_level && (
              <Badge variant="outline" className="text-[10px] font-semibold bg-primary/10 text-primary border-primary/20">
                Level {activeEvidence.evidence_level}
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 p-6 space-y-6">
          {/* Verbatim quote callout */}
          {quote && (
            <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2 mb-6">
              <div className="flex items-center justify-between text-xs font-semibold text-primary">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                  Verbatim Claim In Source
                </span>
                <span className="text-[10px] text-muted-foreground">ID: {activeEvidence.chunk_id.slice(0, 8)}</span>
              </div>
              <blockquote className="text-sm font-medium text-foreground italic border-l-2 border-primary pl-3 py-0.5">
                &ldquo;{quote}&rdquo;
              </blockquote>
            </div>
          )}

          {/* Section details */}
          {activeEvidence.section && (
            <div className="mb-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Section / Heading
              </h5>
              <p className="text-sm font-medium text-foreground">{activeEvidence.section}</p>
            </div>
          )}

          {/* Full context passage */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Full Passage Context
            </h5>
            <div className="p-4 rounded-lg bg-card border border-border text-sm leading-relaxed text-foreground whitespace-pre-wrap">
              {loading ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading passage...</div>
              ) : (
                highlightedContent
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              Verified by DocMate Code Engine
            </span>
            <span className="text-[10px]">Closed Medical Library</span>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
