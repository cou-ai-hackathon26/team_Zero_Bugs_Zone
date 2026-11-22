import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link } from '@/i18n/routing';
import { getFormatter, getLocale, getTranslations } from 'next-intl/server';
import { db } from '@/db';
import { patients, prescriptions, cases, medicineNotices } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { decryptPatientPii } from '@/lib/encryption';
import {
  Users,
  PlusCircle,
  FileText,
  ArrowRight,
  Stethoscope,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Activity,
  CheckCircle,
  HelpCircle,
  Clock,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default async function DashboardPage() {
  const locale = await getLocale();
  const format = await getFormatter();
  const tCases = await getTranslations('cases');
  const tDash = await getTranslations('dashboard');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const isPhysician = user.role === 'doctor' || user.role === 'super_admin';

  // Fetch live stats and doctor's clinical cases
  const [patientCount, prescriptionCount, recentPatientsList, activeNotices, doctorCases] = await Promise.all([
    isPhysician ? db.$count(patients, eq(patients.doctorId, user.id)) : 0,
    isPhysician ? db.$count(prescriptions, eq(prescriptions.doctorId, user.id)) : 0,
    isPhysician
      ? db.query.patients.findMany({
          where: eq(patients.doctorId, user.id),
          orderBy: [desc(patients.updatedAt)],
          limit: 5,
        })
      : [],
    db.select().from(medicineNotices).orderBy(desc(medicineNotices.publishedAt)).limit(3),
    isPhysician
      ? db.query.cases.findMany({
          where: user.role === 'super_admin'
            ? undefined
            : eq(cases.doctorId, user.id),
          orderBy: [desc(cases.updatedAt)],
          limit: 25,
        })
      : [],
  ]);

  const RUNNING_STATUSES = ['draft', 'analyzed', 'insufficient_evidence', 'red_flag'];
  const SOLVED_STATUSES = ['confirmed', 'treated', 'closed'];

  const runningCases = doctorCases.filter((c) => RUNNING_STATUSES.includes(c.status));
  const solvedCases = doctorCases.filter((c) => SOLVED_STATUSES.includes(c.status));

  const decryptedRecentPatients = recentPatientsList.map((p) => ({
    ...p,
    name: decryptPatientPii(p.nameEncrypted),
    phone: decryptPatientPii(p.phoneEncrypted),
  }));

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
          <Badge variant="outline" className="text-[10px] font-semibold text-amber-800 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 gap-1">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            {tCases('statusInsufficient')}
          </Badge>
        );
      case 'confirmed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-teal-800 bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-800 gap-1">
            <CheckCircle2 className="w-3 h-3 text-teal-600" />
            {tCases('statusConfirmed')}
          </Badge>
        );
      case 'treated':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-blue-800 bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 gap-1">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            {tCases('statusTreated')}
          </Badge>
        );
      case 'closed':
        return (
          <Badge variant="outline" className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 gap-1">
            <CheckCircle className="w-3 h-3 text-emerald-600" />
            {tCases('statusClosed')}
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
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* DGDA Active Safety Notices */}
        {activeNotices.length > 0 && (
          <div className="space-y-2">
            {activeNotices.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-xl border text-xs sm:text-sm flex items-start gap-3 ${
                  n.severity === 'critical_recall'
                    ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-900 dark:text-rose-200'
                    : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-300 dark:border-amber-900 text-amber-900 dark:text-amber-200'
                }`}
              >
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{n.title}</span>
                    <Badge
                      variant={n.severity === 'critical_recall' ? 'destructive' : 'outline'}
                      className="text-[10px]"
                    >
                      {n.severity === 'critical_recall'
                        ? locale === 'bn'
                          ? '🚨 জরুরি প্রত্যাহার (DGDA Recall)'
                          : '🚨 Critical Recall'
                        : locale === 'bn'
                          ? '⚠️ সতর্কতা'
                          : '⚠️ Warning'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Doctor Header & Welcome */}
        <PageHeader
          title={
            locale === 'bn'
              ? `স্বাগতম, ${user.name}`
              : `Welcome, ${user.name}`
          }
          subtitle={
            locale === 'bn'
              ? 'ক্লিনিকাল প্র্যাকটিস, চলমান কেস ও প্রেসক্রিপশন সহকারী'
              : 'Clinical practice, active cases, and digital prescription assistant'
          }
          action={
            <Link href="/patients/new">
              <Button className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-xs">
                <PlusCircle className="w-4 h-4" />
                <span>{tCases('newIntake')}</span>
              </Button>
            </Link>
          }
        />

        {/* Summary Metric Cards: Patients, Running Cases, Solved Cases, Prescriptions */}
        <div data-tour="dashboard-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>{locale === 'bn' ? 'নিবন্ধিত রোগী' : 'Registered Patients'}</span>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground mt-1">
                {format.number(patientCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
              {locale === 'bn' ? 'সংরক্ষিত রোগী' : 'Active patients'}
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>{tDash('runningCases')}</span>
                <Activity className="w-4 h-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-primary mt-1">
                {format.number(runningCases.length)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
              {tDash('runningCasesHint')}
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>{tDash('solvedCases')}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {format.number(solvedCases.length)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
              {tDash('solvedCasesHint')}
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>{locale === 'bn' ? 'প্রেসক্রিপশন' : 'Prescriptions'}</span>
                <FileText className="w-4 h-4 text-muted-foreground" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground mt-1">
                {format.number(prescriptionCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
              {locale === 'bn' ? 'তৈরি প্রেসক্রিপশন' : 'Issued records'}
            </CardContent>
          </Card>
        </div>

        {/* Clinical Cases Section: Running vs Solved Cases */}
        {isPhysician && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  <span>{tDash('clinicalCases')}</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {tDash('clinicalCasesDesc')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/cases"
                  className={buttonVariants({ variant: 'outline', size: 'sm', className: 'text-xs h-8 gap-1' })}
                >
                  <span>{tDash('viewAllCases')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <Tabs defaultValue="running" className="w-full">
              <TabsList className="bg-muted/60 p-1 border border-border/60">
                <TabsTrigger value="running" className="gap-2 text-xs font-semibold">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span>{tDash('runningCases')}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4 bg-primary/10 text-primary">
                    {format.number(runningCases.length)}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="solved" className="gap-2 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{tDash('solvedCases')}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-mono h-4 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {format.number(solvedCases.length)}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {/* Running Cases Tab Content */}
              <TabsContent value="running" className="mt-3">
                {runningCases.length === 0 ? (
                  <Card className="p-8 text-center border-dashed">
                    <CardContent className="p-0 space-y-3">
                      <Activity className="w-10 h-10 text-muted-foreground mx-auto" />
                      <p className="text-base font-semibold text-foreground">
                        {tDash('emptyRunning')}
                      </p>
                      <Link href="/patients/new" className={buttonVariants({ className: 'min-h-11 mt-2' })}>
                        <PlusCircle className="w-4 h-4 mr-2" />
                        <span>{tCases('newIntake')}</span>
                      </Link>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border shadow-xs overflow-hidden">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent bg-muted/40">
                            <TableHead className="w-28 font-semibold">{tCases('patientCode')}</TableHead>
                            <TableHead className="font-semibold">{tCases('chiefComplaint')}</TableHead>
                            <TableHead className="w-28 font-semibold">{tCases('ageGender')}</TableHead>
                            <TableHead className="w-44 font-semibold">{locale === 'bn' ? 'অবস্থা' : 'Status'}</TableHead>
                            <TableHead className="w-32 font-semibold">{locale === 'bn' ? 'তারিখ' : 'Date'}</TableHead>
                            <TableHead className="w-28 text-right font-semibold">{locale === 'bn' ? 'অ্যাকশন' : 'Action'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runningCases.map((c) => {
                            const input = (c.structuredInput || {}) as Record<string, unknown>;
                            return (
                              <TableRow key={c.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-mono font-bold text-xs text-primary">
                                  {c.patientCode}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm text-foreground">
                                    {String(input.chief_complaint || 'Clinical Case Intake')}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {typeof input.age === 'number' ? format.number(input.age) : '—'}{' '}
                                  {input.gender ? `(${String(input.gender)})` : ''}
                                </TableCell>
                                <TableCell>{getStatusBadge(c.status)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 opacity-60" />
                                    {format.dateTime(new Date(c.updatedAt || c.createdAt), { dateStyle: 'medium', timeZone: 'UTC' })}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Link
                                    href={`/cases/${c.id}`}
                                    className={buttonVariants({
                                      variant: 'ghost',
                                      size: 'sm',
                                      className: 'h-8 px-2 text-primary hover:text-primary gap-1 text-xs font-semibold',
                                    })}
                                  >
                                    <span>{tDash('openWorkspace')}</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </Link>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Solved Cases Tab Content */}
              <TabsContent value="solved" className="mt-3">
                {solvedCases.length === 0 ? (
                  <Card className="p-8 text-center border-dashed">
                    <CardContent className="p-0 space-y-3">
                      <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto" />
                      <p className="text-base font-semibold text-foreground">
                        {tDash('emptySolved')}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-border shadow-xs overflow-hidden">
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent bg-muted/40">
                            <TableHead className="w-28 font-semibold">{tCases('patientCode')}</TableHead>
                            <TableHead className="font-semibold">{tCases('chiefComplaint')}</TableHead>
                            <TableHead className="w-64 font-semibold">{tDash('confirmedDx')}</TableHead>
                            <TableHead className="w-36 font-semibold">{locale === 'bn' ? 'অবস্থা' : 'Status'}</TableHead>
                            <TableHead className="w-32 font-semibold">{locale === 'bn' ? 'তারিখ' : 'Date'}</TableHead>
                            <TableHead className="w-28 text-right font-semibold">{locale === 'bn' ? 'অ্যাকশন' : 'Action'}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {solvedCases.map((c) => {
                            const input = (c.structuredInput || {}) as Record<string, unknown>;
                            return (
                              <TableRow key={c.id} className="hover:bg-muted/50 transition-colors">
                                <TableCell className="font-mono font-bold text-xs text-primary">
                                  {c.patientCode}
                                </TableCell>
                                <TableCell>
                                  <div className="font-medium text-sm text-foreground">
                                    {String(input.chief_complaint || 'Clinical Case Intake')}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5 inline shrink-0 text-emerald-600" />
                                    <span>{c.confirmedDiagnosis || 'Assessment Completed'}</span>
                                  </div>
                                </TableCell>
                                <TableCell>{getStatusBadge(c.status)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3 opacity-60" />
                                    {format.dateTime(new Date(c.updatedAt || c.createdAt), { dateStyle: 'medium', timeZone: 'UTC' })}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <Link
                                    href={`/cases/${c.id}`}
                                    className={buttonVariants({
                                      variant: 'ghost',
                                      size: 'sm',
                                      className: 'h-8 px-2 text-primary hover:text-primary gap-1 text-xs font-semibold',
                                    })}
                                  >
                                    <span>{tDash('reviewCase')}</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </Link>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Recently Seen Patients Section */}
        {isPhysician && (
          <div data-tour="dashboard-recent" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span>{locale === 'bn' ? 'সম্প্রতি দেখা রোগীগণ' : 'Recently Seen Patients'}</span>
              </h2>
              <Link
                href="/patients"
                className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'min-h-10 text-sm' })}
              >
                <span>{locale === 'bn' ? 'সকল রোগী দেখুন' : 'View All Patients'}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </div>

            {decryptedRecentPatients.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <CardContent className="p-0 space-y-3">
                  <Stethoscope className="w-10 h-10 text-muted-foreground mx-auto" />
                  <p className="text-base font-semibold text-foreground">
                    {locale === 'bn' ? 'কোনো রোগী পাওয়া যায়নি' : 'No patients registered yet'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {locale === 'bn'
                      ? 'নতুন রোগী গ্রহণ করতে নিচের বাটনে চাপ দিন।'
                      : 'Click below to register your first patient consultation.'}
                  </p>
                  <Link href="/patients/new" className={buttonVariants({ className: 'min-h-11 mt-2' })}>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    <span>{locale === 'bn' ? 'নতুন রোগী গ্রহণ' : 'New Patient Intake'}</span>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-border shadow-xs overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent bg-muted/40">
                        <TableHead className="w-28 font-semibold">
                          {locale === 'bn' ? 'কোড' : 'Code'}
                        </TableHead>
                        <TableHead className="font-semibold">
                          {locale === 'bn' ? 'রোগীর নাম' : 'Patient Name'}
                        </TableHead>
                        <TableHead className="w-32 font-semibold">
                          {locale === 'bn' ? 'বয়স ও লিঙ্গ' : 'Age & Gender'}
                        </TableHead>
                        <TableHead className="w-28 font-semibold">
                          {locale === 'bn' ? 'রক্তের গ্রুপ' : 'Blood'}
                        </TableHead>
                        <TableHead className="w-36 font-semibold">
                          {locale === 'bn' ? 'যোগাযোগ' : 'Phone'}
                        </TableHead>
                        <TableHead className="w-32 font-semibold">
                          {locale === 'bn' ? 'তারিখ' : 'Date'}
                        </TableHead>
                        <TableHead className="w-28 text-right font-semibold">
                          {locale === 'bn' ? 'অ্যাকশন' : 'Action'}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {decryptedRecentPatients.map((p) => (
                        <TableRow
                          key={p.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <TableCell className="font-mono font-bold text-xs">
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded">
                              {p.patientCode}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/patients/${p.id}`}
                              className="font-bold text-sm text-foreground hover:text-primary transition-colors"
                            >
                              {p.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {p.age} {locale === 'bn' ? 'বছর' : 'yrs'} · {p.gender === 'female' ? (locale === 'bn' ? 'মহিলা' : 'Female') : (locale === 'bn' ? 'পুরুষ' : 'Male')}
                          </TableCell>
                          <TableCell>
                            {p.bloodGroup ? (
                              <Badge variant="outline" className="text-xs font-bold text-destructive border-destructive/30">
                                {p.bloodGroup}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {p.phone || '—'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-muted-foreground/70" />
                              {new Date(p.updatedAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US')}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/patients/${p.id}`}
                              className={buttonVariants({
                                variant: 'ghost',
                                size: 'sm',
                                className: 'h-8 px-2 text-xs font-semibold text-primary hover:text-primary gap-1',
                              })}
                            >
                              <span>{locale === 'bn' ? 'প্রোফাইল' : 'Profile'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
