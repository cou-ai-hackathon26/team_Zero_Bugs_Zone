'use client';

import { ErrorState } from '@/components/shared/ErrorState';
import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/EmptyState';
import { Link, useRouter } from '@/i18n/routing';
import { useFormatter, useTranslations } from 'next-intl';
import {
  PlusCircle,
  Search,
  Filter,
  AlertTriangle,
  ArrowRight,
  Clock,
  Users,
  Loader2,
  CheckCircle2,
  Activity,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';
import { PatientCase, StructuredPatientInput } from '@/types';

interface ExtendedCase extends PatientCase {
  is_running?: boolean;
  is_solved?: boolean;
}

export default function CasesPage() {
  const t = useTranslations('cases');
  const format = useFormatter();
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [casesList, setCasesList] = useState<ExtendedCase[]>([]);
  const [counts, setCounts] = useState<{ all: number; running: number; solved: number }>({
    all: 0,
    running: 0,
    solved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryTab, setCategoryTab] = useState<'all' | 'running' | 'solved'>('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [fetchVersion, setFetchVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const effectiveStatus = statusFilter !== 'all' ? statusFilter : categoryTab !== 'all' ? categoryTab : 'all';
        const response = await fetch(`/api/cases?status=${effectiveStatus}&search=${encodeURIComponent(search)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) {
          setCasesList(data.cases || []);
          if (data.counts) {
            setCounts(data.counts);
          }
        }
      } catch {
        if (!controller.signal.aborted) {
          setLoadError(true);
          setCasesList([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 150);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [categoryTab, statusFilter, search, fetchVersion]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'red_flag':
        return (
          <Badge variant="destructive" className="text-[10px] uppercase font-bold gap-1">
            <AlertTriangle className="w-3 h-3" />
            {t('statusRedFlag')}
          </Badge>
        );
      case 'insufficient_evidence':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-amber-800 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 gap-1">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            {t('statusInsufficient')}
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-teal-800 bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-600" />
            {t('statusConfirmed')}
          </Badge>
        );
      case 'treated':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-blue-800 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            {t('statusTreated')}
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            {t('statusClosed')}
          </Badge>
        );
      case 'analyzed':
        return (
          <Badge variant="secondary" className="text-[10px] font-medium">
            {t('statusAnalyzed')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {t('statusDraft')}
          </Badge>
        );
    }
  };

  const getEmptyMessage = () => {
    if (categoryTab === 'running') return t('emptyRunning');
    if (categoryTab === 'solved') return t('emptySolved');
    return t('emptyCases');
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          action={
            <Link href="/patients/new">
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs">
                <PlusCircle className="w-4 h-4" />
                <span>{t('newIntake')}</span>
              </Button>
            </Link>
          }
        />

        {/* Category Tabs: All, Running, Solved */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Tabs
            value={categoryTab}
            onValueChange={(val) => {
              setCategoryTab(val as 'all' | 'running' | 'solved');
              setStatusFilter('all');
            }}
            className="w-full sm:w-auto"
          >
            <TabsList className="bg-muted/60 p-1 border border-border/60 w-full sm:w-auto grid grid-cols-3 sm:inline-flex">
              <TabsTrigger value="all" className="gap-1.5 text-xs font-semibold">
                <span>{t('tabAll')}</span>
                {counts.all > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4">
                    {format.number(counts.all)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="running" className="gap-1.5 text-xs font-semibold">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span>{t('tabRunning')}</span>
                {counts.running > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4 bg-primary/10 text-primary">
                    {format.number(counts.running)}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="solved" className="gap-1.5 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>{t('tabSolved')}</span>
                {counts.solved > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {format.number(counts.solved)}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="pl-9 text-sm h-9 bg-background border-border"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
              <SelectTrigger aria-label={t('filterStatus')} className="w-48 min-h-11 text-xs">
                <SelectValue placeholder={tCommon('all')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all')}</SelectItem>
                <SelectItem value="running">{t('runningFilter')}</SelectItem>
                <SelectItem value="solved">{t('solvedFilter')}</SelectItem>
                <SelectItem value="draft">{t('statusDraft')}</SelectItem>
                <SelectItem value="analyzed">{t('statusAnalyzed')}</SelectItem>
                <SelectItem value="insufficient_evidence">{t('statusInsufficient')}</SelectItem>
                <SelectItem value="red_flag">{t('statusRedFlag')}</SelectItem>
                <SelectItem value="confirmed">{t('statusConfirmed')}</SelectItem>
                <SelectItem value="treated">{t('statusTreated')}</SelectItem>
                <SelectItem value="closed">{t('statusClosed')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Cases Table */}
        <Card className="border-border shadow-xs overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span>Loading patient cases...</span>
              </div>
            ) : loadError ? (
              <ErrorState message={t('loadError')} onRetry={() => setFetchVersion((version) => version + 1)} />
            ) : casesList.length === 0 ? (
              <EmptyState
                icon={Users}
                title={getEmptyMessage()}
                description="You can start a new patient intake or reset your search and filter criteria."
                actionLabel={t('newIntake')}
                onAction={() => router.push('/patients/new')}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/40">
                    <TableHead className="w-28 font-semibold">{t('patientCode')}</TableHead>
                    <TableHead className="font-semibold">{t('chiefComplaint')}</TableHead>
                    <TableHead className="w-24 font-semibold">টাইপ (Type)</TableHead>
                    <TableHead className="w-28 font-semibold">{t('ageGender')}</TableHead>
                    <TableHead className="w-44 font-semibold">{tCommon('status')}</TableHead>
                    <TableHead className="w-28 font-semibold">{tCommon('date')}</TableHead>
                    <TableHead className="w-28 text-right font-semibold">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {casesList.map((c) => {
                    const input = ((c.structured_input || (c as unknown as Record<string, unknown>).structuredInput) || {}) as unknown as StructuredPatientInput;
                    const patientCode = c.patient_code || (c as unknown as Record<string, unknown>).patientCode as string;
                    const confirmedDx = c.confirmed_diagnosis || (c as unknown as Record<string, unknown>).confirmedDiagnosis as string;
                    const isSolved = ['confirmed', 'treated', 'closed'].includes(c.status);

                    return (
                      <TableRow
                        key={c.id}
                        onClick={() => router.push(`/cases/${c.id}`)}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <TableCell className="font-mono font-bold text-xs text-primary">
                          {patientCode}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium text-sm text-foreground">
                            {String(input.chief_complaint || 'Clinical Case Intake')}
                          </div>
                          {confirmedDx && (
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 inline shrink-0" />
                              <span>Dx: {confirmedDx}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {isSolved ? (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-semibold border-emerald-200">
                              {t('typeSolved')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 text-[10px] font-semibold border-sky-200">
                              {t('typeRunning')}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {typeof input.age === 'number' ? format.number(input.age) : '—'}{' '}
                          {input.gender ? `(${String(input.gender)})` : ''}
                        </TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 opacity-60" />
                            {format.dateTime(new Date(c.updated_at || c.created_at), { dateStyle: 'medium', timeZone: 'UTC' })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-primary hover:text-primary gap-1 text-xs"
                          >
                            <span>{t('openWorkspace')}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
