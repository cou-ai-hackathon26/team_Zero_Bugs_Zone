import React from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { db } from '@/db';
import {
  users,
  cases,
  sources,
  auditLogs,
  doctorVerifications,
  studentVerifications,
  researcherVerifications,
  systemSettings,
} from '@/db/schema';
import { count, eq, sql, gte } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import {
  Users,
  Activity,
  BookOpen,
  History,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations('admin'),
  ]);

  // Query live metrics
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    userRoleCounts,
    [pendingDocs],
    [pendingStudents],
    [pendingResearchers],
    [casesToday],
    [totalCases],
    [totalSources],
    [totalAudit],
    activeKillswitches,
  ] = await Promise.all([
    db
      .select({
        role: users.role,
        count: count(),
      })
      .from(users)
      .groupBy(users.role),
    db.select({ count: count() }).from(doctorVerifications).where(eq(doctorVerifications.status, 'pending')),
    db.select({ count: count() }).from(studentVerifications).where(eq(studentVerifications.status, 'pending')),
    db.select({ count: count() }).from(researcherVerifications).where(eq(researcherVerifications.status, 'pending')),
    db.select({ count: count() }).from(cases).where(gte(cases.createdAt, startOfToday)),
    db.select({ count: count() }).from(cases),
    db.select({ count: count() }).from(sources),
    db.select({ count: count() }).from(auditLogs),
    db.select().from(systemSettings).where(sql`${systemSettings.key} LIKE 'killswitch:%'`),
  ]);

  const totalPending =
    (pendingDocs?.count || 0) +
    (pendingStudents?.count || 0) +
    (pendingResearchers?.count || 0);

  const roleMap: Record<string, number> = {};
  for (const row of userRoleCounts) {
    roleMap[row.role] = row.count;
  }

  return (
    <div className="space-y-6">
      {/* Pending Verifications Alert Banner */}
      {totalPending > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold leading-tight">
                {locale === 'bn'
                  ? `${totalPending} জন ব্যবহারকারী পেশাদার যাচাইকরণের অপেক্ষায় আছেন`
                  : `${totalPending} professional verification requests pending review`}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {locale === 'bn'
                  ? `চিকিৎসক: ${pendingDocs?.count || 0}, শিক্ষার্থী: ${pendingStudents?.count || 0}, গবেষক: ${pendingResearchers?.count || 0}`
                  : `Doctors: ${pendingDocs?.count || 0}, Students: ${pendingStudents?.count || 0}, Researchers: ${pendingResearchers?.count || 0}`}
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}/admin/users`}
            className={buttonVariants({ variant: 'outline', size: 'sm', className: 'border-amber-500/40 hover:bg-amber-500/20 text-xs shrink-0 font-medium' })}
          >
            <span>{t('reviewPending')}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Link>
        </div>
      )}

      {/* Kill Switch Active Warning Banner */}
      <div data-tour="admin-killswitches">
      {activeKillswitches.length > 0 ? (
        <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold leading-tight">
                {t('killswitchEngagedAlert')}
              </h2>
              <p className="text-xs text-destructive/80 mt-0.5">
                {activeKillswitches.length} {locale === 'bn' ? 'টি ফিচার স্থগিত আছে' : 'features currently halted'}
              </p>
            </div>
          </div>
          <Link
            href={`/${locale}/admin/ai`}
            className={buttonVariants({ variant: 'destructive', size: 'sm', className: 'text-xs shrink-0 font-medium' })}
          >
            <span>{t('ai')}</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          </Link>
        </div>
      ) : (
        <div className="p-3 rounded-lg border border-border bg-muted/40 text-foreground flex items-center gap-2.5 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <span>{t('allSystemsOperational')}</span>
        </div>
      )}
      </div>

      {/* Top Stats Cards */}
      <div data-tour="admin-stats" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Users */}
        <Card className="border-border bg-card shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {locale === 'bn' ? 'ব্যবহারকারী সংখ্যা' : 'Registered Users'}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {Object.values(roleMap).reduce((a, b) => a + b, 0)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {locale === 'bn'
                ? `চিকিৎসক: ${roleMap['doctor'] || 0} | রোগী: ${roleMap['patient'] || 0} | শিক্ষার্থী: ${roleMap['student'] || 0}`
                : `Doctors: ${roleMap['doctor'] || 0} | Patients: ${roleMap['patient'] || 0} | Students: ${roleMap['student'] || 0}`}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Cases */}
        <Card className="border-border bg-card shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('activeCasesToday')}
            </CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {casesToday?.count || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t('totalCases')}: {totalCases?.count || 0}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Sources */}
        <Card className="border-border bg-card shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('totalSources')}
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {totalSources?.count || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {locale === 'bn' ? 'অনুমোদিত ক্লিনিকাল রেফারেন্স' : 'Approved Clinical References'}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Audit */}
        <Card data-tour="admin-audit" className="border-border bg-card shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {t('totalLogs')}
            </CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {totalAudit?.count || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {locale === 'bn' ? 'ক্রিপ্টোগ্রাফিক হ্যাশ চেইনে সংরক্ষিত' : 'Stored in hash-chained audit'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Control Plane Quick Links Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Users */}
        <Card className="border-border bg-card shadow-2xs flex flex-col justify-between">
          <CardHeader>
            <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center mb-2">
              <UserCheck className="w-4 h-4" />
            </div>
            <CardTitle className="text-sm font-semibold">{t('users')}</CardTitle>
            <CardDescription className="text-xs leading-normal">
              {locale === 'bn'
                ? 'বিএমডিসি সনদ ও ইউজার ভেরিফিকেশন পরিচালনা করুন।'
                : 'Review medical licenses and user verifications.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href={`/${locale}/admin/users`}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full text-xs font-medium' })}
            >
              <span>{locale === 'bn' ? 'তালিকা দেখুন' : 'View Users'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Feature Matrix */}
        <Card className="border-border bg-card shadow-2xs flex flex-col justify-between">
          <CardHeader>
            <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center mb-2">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <CardTitle className="text-sm font-semibold">{t('access')}</CardTitle>
            <CardDescription className="text-xs leading-normal">
              {locale === 'bn'
                ? 'রোল ভিত্তিক ফিচার অনুমতি ও সীমা পরিচালনা করুন।'
                : 'Manage role permissions and feature limits.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href={`/${locale}/admin/access`}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full text-xs font-medium' })}
            >
              <span>{locale === 'bn' ? 'ম্যাট্রিক্স দেখুন' : 'View Matrix'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </CardContent>
        </Card>

        {/* Audit Log */}
        <Card className="border-border bg-card shadow-2xs flex flex-col justify-between">
          <CardHeader>
            <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center mb-2">
              <History className="w-4 h-4" />
            </div>
            <CardTitle className="text-sm font-semibold">{t('audit')}</CardTitle>
            <CardDescription className="text-xs leading-normal">
              {locale === 'bn'
                ? 'ক্রিপ্টোগ্রাফিক হ্যাশ চেইন ও সিস্টেম অডিট পরীক্ষা করুন।'
                : 'Verify hash chains and system audit logs.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Link
              href={`/${locale}/admin/audit`}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'w-full text-xs font-medium' })}
            >
              <span>{locale === 'bn' ? 'অডিট দেখুন' : 'View Logs'}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
