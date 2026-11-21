import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/db';
import { cases, drugs, sources } from '@/db/schema';
import { and, desc, eq, ne } from 'drizzle-orm';
import {
  Users,
  PlusCircle,
  FileText,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  HelpCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');
  const tCases = await getTranslations('cases');
  const tIntake = await getTranslations('intake');

  const user = await getCurrentUser();
  if (!user) redirect(`/${await getLocale()}/login`);

  const canOpenCases = user.role === 'doctor' || user.role === 'super_admin';
  const owner = eq(cases.doctorId, user.id);
  const format = await getFormatter();
  const [allCases, activeCount, redFlagCount, sourceCount, drugCount] = await Promise.all([
    canOpenCases ? db.query.cases.findMany({
      where: owner,
      columns: { id: true, patientCode: true, status: true, structuredInput: true, confirmedDiagnosis: true, updatedAt: true },
      orderBy: [desc(cases.updatedAt)],
      limit: 6,
    }) : [],
    canOpenCases ? db.$count(cases, and(owner, ne(cases.status, 'closed'))) : 0,
    canOpenCases ? db.$count(cases, and(owner, eq(cases.status, 'red_flag'))) : 0,
    db.$count(sources, eq(sources.status, 'active')),
    db.$count(drugs),
  ]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'red_flag':
        return (
          <Badge variant="destructive" className="text-[10px] uppercase font-bold gap-1">
            <AlertTriangle className="w-3 h-3" />
            {tCases('statusRedFlag')}
          </Badge>
        );
      case 'insufficient_evidence':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-foreground bg-muted">
            {tCases('statusInsufficient')}
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-foreground bg-muted">
            {tCases('statusConfirmed')}
          </Badge>
        );
      case 'treated':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-foreground bg-muted">
            {tCases('statusTreated')}
          </Badge>
        );
      case 'analyzed':
        return (
          <Badge variant="secondary" className="text-[10px] font-medium">
            {tCases('statusAnalyzed')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            {tCases('statusDraft')}
          </Badge>
        );
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('welcome')}
          subtitle={t('description')}
          action={canOpenCases && (
            <Link href="/cases/new" className={buttonVariants({ className: 'min-h-11 whitespace-normal text-center' })}>
              <PlusCircle />
              {t('startNewCase')}
            </Link>
          )}
        />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {canOpenCases && (
            <>
              <Card className="border-border shadow-2xs">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>{t('activeCases')}</span>
                    <Users className="w-4 h-4 text-primary" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold text-foreground">
                    {format.number(activeCount)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
                  {t('activeHint')}
                </CardContent>
              </Card>

              <Card className="border-border shadow-2xs">
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <span>{t('criticalAlerts')}</span>
                    <AlertTriangle className="w-4 h-4 text-destructive" />
                  </CardDescription>
                  <CardTitle className="text-2xl font-bold text-destructive">
                    {format.number(redFlagCount)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-[11px] text-destructive">
                  {t('criticalHint')}
                </CardContent>
              </Card>
            </>
          )}
          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{t('librarySources')}</span>
                <BookOpen className="w-4 h-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {format.number(sourceCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              {t('sourceHint')}
            </CardContent>
          </Card>

          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{t('formulary')}</span>
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {format.number(drugCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              {t('formularyHint')}
            </CardContent>
          </Card>
        </div>

        {/* Action Callout Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {canOpenCases && <Card className="border-primary/30 bg-primary/5 hover:border-primary/50 transition-colors">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary" />
                <span>{t('startNewCase')}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                {t('intakeHint')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              <Link href="/cases/new" className={buttonVariants({ size: 'sm', className: 'min-h-11 whitespace-normal' })}>
                {tCases('newIntake')}
                <ArrowRight />
              </Link>
            </CardContent>
          </Card>}

          <Card className="border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50 transition-colors">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{t('quickAsk')}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                {t('askHint')}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              <Link href="/ask" className={buttonVariants({ size: 'sm', variant: 'outline', className: 'min-h-11 whitespace-normal' })}>
                {t('quickAsk')}
                <ArrowRight />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Cases Section */}
        {canOpenCases && <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">{t('recentCases')}</h2>
            <Link href="/cases" className={buttonVariants({ size: 'sm', variant: 'ghost', className: 'min-h-11 whitespace-normal' })}>
              {t('viewAllCases')}
              <ArrowRight />
            </Link>
          </div>

          {allCases.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <CardContent className="p-0 space-y-2">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">{t('noCases')}</p>
                <Link href="/cases/new" className={buttonVariants({ size: 'sm', className: 'mt-2 min-h-11 whitespace-normal' })}>
                  {t('startNewCase')}
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 lg:grid-cols-3 gap-4">
              {allCases.map((c) => {
                const input = c.structuredInput as Record<string, unknown>;
                const symptoms = Array.isArray(input.symptoms) ? (input.symptoms as string[]) : [];
                return (
                  <Link key={c.id} href={`/cases/${c.id}`} className="block group">
                    <Card className="h-full border-border hover:border-primary/50 transition-all hover:shadow-xs bg-card">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {c.patientCode}
                          </span>
                          {getStatusBadge(c.status)}
                        </div>
                        <CardTitle className="text-sm font-semibold text-foreground wrap-anywhere pt-1">
                          {String(input.chief_complaint || tCases('chiefComplaint'))}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>
                            {tIntake('age')}{' '}{typeof input.age === 'number' ? format.number(input.age) : '—'}
                          </span>
                          {symptoms.length > 0 && (
                            <span className="wrap-anywhere">
                              • {symptoms.slice(0, 2).join(', ')}
                            </span>
                          )}
                        </div>
                        {c.confirmedDiagnosis && (
                          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded wrap-anywhere">
                            {tCases('statusConfirmed')}{' · '}{c.confirmedDiagnosis}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
                          <Clock className="w-3 h-3" />
                          <span>{format.dateTime(c.updatedAt, { dateStyle: 'medium', timeZone: 'UTC' })}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>}
      </div>
    </AppShell>
  );
}
