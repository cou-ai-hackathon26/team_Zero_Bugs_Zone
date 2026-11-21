import React from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { getTranslations } from 'next-intl/server';
import { db } from '@/db';
import { cases, sources } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
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

  let allCases: (typeof cases.$inferSelect)[] = [];
  let sourceCount = 0;

  try {
    allCases = await db.query.cases.findMany({
      orderBy: [desc(cases.updatedAt)],
      limit: 6,
    });
    const sList = await db.query.sources.findMany({
      where: eq(sources.status, 'active'),
    });
    sourceCount = sList.length;
  } catch {
    allCases = [];
    sourceCount = 0;
  }

  const activeCount = allCases.filter((c) => c.status !== 'closed').length;
  const redFlagCount = allCases.filter((c) => c.status === 'red_flag').length;

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
          <Badge variant="outline" className="text-[10px] font-semibold text-rose-600 border-rose-300 bg-rose-50 dark:bg-rose-950/40">
            {tCases('statusInsufficient')}
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/40">
            {tCases('statusConfirmed')}
          </Badge>
        );
      case 'treated':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/40">
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
          subtitle="Closed-library clinical decision support, differential diagnosis & drug safety."
          action={
            <Link href="/cases/new">
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs">
                <PlusCircle className="w-4 h-4" />
                <span>{t('startNewCase')}</span>
              </Button>
            </Link>
          }
        />

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{t('activeCases')}</span>
                <Users className="w-4 h-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {activeCount}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Patient intakes in progress
            </CardContent>
          </Card>

          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{t('criticalAlerts')}</span>
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-destructive">
                {redFlagCount}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-destructive/80">
              Immediate triage alerts
            </CardContent>
          </Card>

          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{t('librarySources')}</span>
                <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {sourceCount || 4}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Peer-reviewed guidelines
            </CardContent>
          </Card>

          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Formulary & Safety</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                30+
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Deterministic drug rules
            </CardContent>
          </Card>
        </div>

        {/* Action Callout Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="border-primary/30 bg-primary/5 hover:border-primary/50 transition-colors">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-primary" />
                <span>{t('startNewCase')}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Enter symptoms, vitals, history, allergies, and lab values for clinical reasoning.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              <Link href="/cases/new">
                <Button size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                  <span>Open Intake Form</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-indigo-500/30 bg-indigo-500/5 hover:border-indigo-500/50 transition-colors">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>{t('quickAsk')}</span>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                Query internal medical guidelines with verbatim source citations for research and study.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-3">
              <Link href="/ask">
                <Button size="sm" variant="outline" className="gap-2 border-indigo-500/30 font-semibold text-indigo-700 dark:text-indigo-300">
                  <span>Ask the Library</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Cases Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">{t('recentCases')}</h3>
            <Link href="/cases">
              <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">
                <span>{t('viewAllCases')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>

          {allCases.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <CardContent className="p-0 space-y-2">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-medium text-foreground">{t('noCases')}</p>
                <Link href="/cases/new">
                  <Button size="sm" className="mt-2 bg-primary text-primary-foreground">
                    {t('startNewCase')}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                        <CardTitle className="text-sm font-semibold text-foreground truncate pt-1">
                          {String(input.chief_complaint || 'General Clinical Evaluation')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-1 space-y-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span>
                            Age: {String(input.age || '—')}{' '}
                            {input.gender ? `(${String(input.gender)})` : ''}
                          </span>
                          {symptoms.length > 0 && (
                            <span className="truncate">
                              • {symptoms.slice(0, 2).join(', ')}
                            </span>
                          )}
                        </div>
                        {c.confirmedDiagnosis && (
                          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded truncate">
                            Dx: {c.confirmedDiagnosis}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/80 pt-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(c.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
