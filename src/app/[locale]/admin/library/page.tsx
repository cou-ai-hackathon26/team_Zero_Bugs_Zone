'use client';

import React, { useState, useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CheckCircle,
  Archive,
  RefreshCw,
  Loader2,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { toast } from 'sonner';

interface SourceRecord {
  id: string;
  title: string;
  type: string;
  year: number;
  license: string;
  url?: string | null;
  status: string;
  chunkCount: number;
  createdAt: string;
}

export default function AdminLibraryPage() {
  const locale = useLocale();
  const t = useTranslations('admin');

  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/library', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSources(data.sources || []);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          toast.error('Failed to load sources');
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [refreshTrigger]);

  const toggleStatus = async (sourceId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'active' ? 'archived' : 'active';
    setActionLoading(true);
    try {
      const res = await fetch('/api/admin/library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_publish',
          sourceId,
          status: nextStatus,
        }),
      });

      if (!res.ok) throw new Error('Failed to update status');
      toast.success(
        nextStatus === 'active'
          ? (locale === 'bn' ? 'সোর্স সক্রিয় করা হয়েছে' : 'Source published')
          : (locale === 'bn' ? 'সোর্স আর্কাইভ করা হয়েছে' : 'Source archived')
      );
      setRefreshTrigger((v) => v + 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t('library')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {locale === 'bn'
              ? 'অনুমোদিত মেডিকেল গাইডলাইন, পাঠ্যপুস্তক ও ড্রাগ মনোগ্রাফের প্রকাশনা স্থিতি এবং খণ্ডাংশ (Chunks) পর্যবেক্ষণ।'
              : 'Manage verified internal reference materials, chunk segmentations, and publication states.'}
          </p>
        </div>

        <Button
          onClick={() => {
            setLoading(true);
            setRefreshTrigger((v) => v + 1);
          }}
          variant="outline"
          size="sm"
          disabled={loading}
          className="text-xs self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{locale === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Sources List */}
      <div className="space-y-3">
        {loading ? (
          <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs">{locale === 'bn' ? 'লাইব্রেরি লোড হচ্ছে...' : 'Loading sources...'}</span>
          </div>
        ) : sources.length === 0 ? (
          <Card className="border-border p-12 text-center text-muted-foreground">
            <p className="text-sm font-medium">
              {locale === 'bn' ? 'কোনো রেফারেন্স সোর্স পাওয়া যায়নি' : 'No library sources found'}
            </p>
          </Card>
        ) : (
          sources.map((s) => {
            const isActive = s.status === 'active';
            return (
              <Card key={s.id} className="border-border bg-card shadow-2xs">
                <CardContent className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{s.title}</span>
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                        {s.type} ({s.year})
                      </span>
                      {isActive ? (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          <span>PUBLISHED</span>
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded font-semibold bg-muted text-muted-foreground flex items-center gap-1">
                          <Archive className="w-3 h-3" />
                          <span>ARCHIVED</span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <span className="font-semibold text-foreground">{s.chunkCount}</span>
                        <span>{locale === 'bn' ? 'টি খণ্ডাংশ (Chunks)' : 'Text Chunks'}</span>
                      </span>
                      <span>License: {s.license}</span>
                      {s.url && (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline flex items-center gap-1 hover:text-primary/80"
                        >
                          <span>URL</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                    <Button
                      size="sm"
                      variant={isActive ? 'outline' : 'secondary'}
                      onClick={() => toggleStatus(s.id, s.status)}
                      disabled={actionLoading}
                      className="text-xs h-8 px-3"
                    >
                      {isActive ? (
                        <>
                          <Archive className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                          <span>{locale === 'bn' ? 'আর্কাইভ করুন' : 'Archive'}</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                          <span>{locale === 'bn' ? 'প্রকাশ করুন (Publish)' : 'Publish'}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
