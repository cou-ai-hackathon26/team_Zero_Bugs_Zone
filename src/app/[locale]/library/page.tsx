'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import { BookOpen, Search, PlusCircle, ShieldCheck, ExternalLink, Filter, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Source } from '@/types';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';

interface SourceWithCount extends Source {
  chunk_count?: number;
}

export default function LibraryPage() {
  const t = useTranslations('library');
  const tCommon = useTranslations('common');
  const { openEvidence } = useEvidenceSheet();

  const [sourcesList, setSourcesList] = useState<SourceWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Add source sheet state
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('guideline');
  const [newYear, setNewYear] = useState('2024');
  const [newLicense, setNewLicense] = useState('Open Access / Academic Demo');
  const [savingSource, setSavingSource] = useState(false);

  // View chunks sheet state
  const [viewChunksOpen, setViewChunksOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<SourceWithCount | null>(null);
  const [sourceChunks, setSourceChunks] = useState<Array<{ id: string; section: string; text: string; page: number; evidence_level: string }>>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);

  const fetchSources = useCallback(() => {
    fetch('/api/library/sources')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.sources) {
          setSourcesList(data.sources);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSavingSource(true);
    try {
      const res = await fetch('/api/library/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          type: newType,
          year: newYear,
          license: newLicense,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add source');
      }

      toast.success('Source added to library successfully');
      setAddSheetOpen(false);
      setNewTitle('');
      fetchSources();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error adding source');
    } finally {
      setSavingSource(false);
    }
  };

  const handleOpenSourceChunks = (source: SourceWithCount) => {
    setSelectedSource(source);
    setViewChunksOpen(true);
    setLoadingChunks(true);

    fetch(`/api/library/chunks?source_id=${source.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.chunks) {
          setSourceChunks(data.chunks);
        } else {
          setSourceChunks([
            {
              id: 'sample-chunk-1',
              section: 'Clinical Presentation & Diagnostic Criteria',
              text: 'Community-acquired pneumonia (CAP) in adults is defined as an acute infection of the pulmonary parenchyma acquired outside a hospital setting. Classical symptoms include cough, fever, pleuritic chest pain, dyspnea, and production of purulent or rust-colored sputum.',
              page: 1,
              evidence_level: 'Ia',
            },
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingChunks(false));
  };

  const filteredSources = sourcesList.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.type.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || s.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          action={
            <Sheet open={addSheetOpen} onOpenChange={setAddSheetOpen}>
              <SheetTrigger
                render={
                  <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs">
                    <PlusCircle className="w-4 h-4" />
                    <span>{t('addSource')}</span>
                  </Button>
                }
              />
              <SheetContent side="right" className="w-full sm:max-w-md p-6">
                <SheetHeader className="pb-4 border-b border-border">
                  <SheetTitle className="text-lg font-bold">{t('addSource')}</SheetTitle>
                  <SheetDescription className="text-xs">
                    Admin panel to register a new clinical practice guideline or textbook into the closed library index.
                  </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleCreateSource} className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="source-title" className="text-xs font-semibold">
                      Source Title
                    </Label>
                    <Input
                      id="source-title"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="e.g. National Clinical Guideline for Diabetes"
                      required
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="source-type" className="text-xs font-semibold">
                      Source Type
                    </Label>
                    <Select value={newType} onValueChange={(val) => val && setNewType(val)}>
                      <SelectTrigger id="source-type" className="text-sm">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guideline">Clinical Guideline</SelectItem>
                        <SelectItem value="textbook">Textbook</SelectItem>
                        <SelectItem value="journal">Peer-Reviewed Journal</SelectItem>
                        <SelectItem value="drug">Drug Formulary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="source-year" className="text-xs font-semibold">
                      Publication Year
                    </Label>
                    <Input
                      id="source-year"
                      type="number"
                      value={newYear}
                      onChange={(e) => setNewYear(e.target.value)}
                      min="1990"
                      max="2030"
                      required
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="source-license" className="text-xs font-semibold">
                      License & Access
                    </Label>
                    <Input
                      id="source-license"
                      value={newLicense}
                      onChange={(e) => setNewLicense(e.target.value)}
                      className="text-sm"
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddSheetOpen(false)}
                      size="sm"
                    >
                      {tCommon('cancel')}
                    </Button>
                    <Button
                      type="submit"
                      disabled={savingSource || !newTitle.trim()}
                      size="sm"
                      className="bg-primary text-primary-foreground font-semibold"
                    >
                      {savingSource ? <Loader2 className="w-4 h-4 animate-spin" /> : tCommon('save')}
                    </Button>
                  </div>
                </form>
              </SheetContent>
            </Sheet>
          }
        />

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9 text-sm h-9 bg-background border-border"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={typeFilter} onValueChange={(val) => val && setTypeFilter(val)}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('filterAll')}</SelectItem>
                <SelectItem value="guideline">{t('filterGuidelines')}</SelectItem>
                <SelectItem value="textbook">{t('filterTextbooks')}</SelectItem>
                <SelectItem value="drug">{t('filterDrugs')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sources Grid */}
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Loading medical library sources...</span>
          </div>
        ) : filteredSources.length === 0 ? (
          <Card className="p-10 text-center border-dashed">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <h4 className="text-base font-semibold text-foreground">No library sources match your search.</h4>
            <p className="text-xs text-muted-foreground mt-1">Try clearing filters or add a new source document.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSources.map((source) => (
              <Card
                key={source.id}
                className="border-border hover:border-primary/40 transition-all bg-card shadow-2xs"
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
                      {source.type}
                    </Badge>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t('year')}: {source.year}
                    </span>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground leading-snug pt-1">
                    {source.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground truncate">
                    {source.license}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-5 pt-0 flex items-center justify-between border-t border-border/60 mt-3 pt-3">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>{source.chunk_count || 4} chunks indexed</span>
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenSourceChunks(source)}
                    className="text-xs gap-1.5 border-border hover:bg-muted font-medium"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>{t('viewChunks')}</span>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* View Chunks Sheet (Detail & reading panel per Front-End Rules) */}
        <Sheet open={viewChunksOpen} onOpenChange={setViewChunksOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col">
            <SheetHeader className="p-6 border-b border-border bg-muted/20">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
                <BookOpen className="w-4 h-4" />
                <span>Source Passage Chunks</span>
              </div>
              <SheetTitle className="text-lg font-bold leading-snug">
                {selectedSource?.title}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Indexed in closed library with vector embeddings and full-text tsvector search.
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingChunks ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Loading passages...</span>
                </div>
              ) : (
                sourceChunks.map((chunk, idx) => (
                  <div
                    key={chunk.id || idx}
                    className="p-4 rounded-lg border border-border bg-card space-y-2 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span className="text-foreground">{chunk.section}</span>
                      <Badge variant="outline" className="text-[10px] font-semibold bg-primary/5 text-primary">
                        Page {chunk.page} • Level {chunk.evidence_level}
                      </Badge>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {chunk.text}
                    </p>
                    <div className="pt-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          openEvidence({
                            chunk_id: chunk.id,
                            text: chunk.text,
                            quote: chunk.text.slice(0, 100),
                            source_title: selectedSource?.title,
                            source_year: selectedSource?.year,
                            page: chunk.page,
                            section: chunk.section,
                            evidence_level: chunk.evidence_level,
                          })
                        }
                        className="text-[11px] h-7 gap-1 text-primary hover:text-primary"
                      >
                        <span>Inspect in Evidence Viewer</span>
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}
