'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/EmptyState';
import { Link, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { PlusCircle, Search, Filter, AlertTriangle, ArrowRight, Clock, Users, Loader2 } from 'lucide-react';
import { PatientCase, StructuredPatientInput } from '@/types';

export default function CasesPage() {
  const t = useTranslations('cases');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [casesList, setCasesList] = useState<PatientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchCases = useCallback(() => {
    fetch(`/api/cases?status=${statusFilter}&search=${encodeURIComponent(search)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.cases) {
          setCasesList(data.cases);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

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
          <Badge variant="outline" className="text-[10px] font-semibold text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/40">
            {t('statusInsufficient')}
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
            {t('statusConfirmed')}
          </Badge>
        );
      case 'treated':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/40">
            {t('statusTreated')}
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

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('title')}
          subtitle={t('subtitle')}
          action={
            <Link href="/cases/new">
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs">
                <PlusCircle className="w-4 h-4" />
                <span>{t('newIntake')}</span>
              </Button>
            </Link>
          }
        />

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
          <div className="relative flex-1 w-full sm:w-auto">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient code, symptoms, or complaint..."
              className="pl-9 text-sm h-9 bg-background border-border"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(val) => val && setStatusFilter(val)}>
              <SelectTrigger className="w-48 h-9 text-xs">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tCommon('all')}</SelectItem>
                <SelectItem value="draft">{t('statusDraft')}</SelectItem>
                <SelectItem value="analyzed">{t('statusAnalyzed')}</SelectItem>
                <SelectItem value="insufficient_evidence">{t('statusInsufficient')}</SelectItem>
                <SelectItem value="red_flag">{t('statusRedFlag')}</SelectItem>
                <SelectItem value="confirmed">{t('statusConfirmed')}</SelectItem>
                <SelectItem value="treated">{t('statusTreated')}</SelectItem>
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
            ) : casesList.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t('emptyCases')}
                description="No matching clinical cases found. You can start a new patient intake or reset your filters."
                actionLabel={t('newIntake')}
                onAction={() => router.push('/cases/new')}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/40">
                    <TableHead className="w-28 font-semibold">{t('patientCode')}</TableHead>
                    <TableHead className="font-semibold">{t('chiefComplaint')}</TableHead>
                    <TableHead className="w-28 font-semibold">{t('ageGender')}</TableHead>
                    <TableHead className="w-44 font-semibold">{tCommon('status')}</TableHead>
                    <TableHead className="w-28 font-semibold">{tCommon('date')}</TableHead>
                    <TableHead className="w-24 text-right font-semibold">{tCommon('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {casesList.map((c) => {
                    const input = ((c.structured_input || (c as unknown as Record<string, unknown>).structuredInput) || {}) as unknown as StructuredPatientInput;
                    const patientCode = c.patient_code || (c as unknown as Record<string, unknown>).patientCode as string;
                    const confirmedDx = c.confirmed_diagnosis || (c as unknown as Record<string, unknown>).confirmedDiagnosis as string;
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
                            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                              Dx: {confirmedDx}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {String(input.age || '—')}{' '}
                          {input.gender ? `(${String(input.gender)})` : ''}
                        </TableCell>
                        <TableCell>{getStatusBadge(c.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 opacity-60" />
                            {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-primary hover:text-primary gap-1 text-xs"
                          >
                            <span>Open</span>
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
