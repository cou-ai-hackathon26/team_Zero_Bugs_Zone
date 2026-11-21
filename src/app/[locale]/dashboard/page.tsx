import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { getFormatter, getLocale } from 'next-intl/server';
import { db } from '@/db';
import { patients, prescriptions, sources, drugs, medicineNotices } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { decryptPatientPii } from '@/lib/encryption';
import {
  Users,
  PlusCircle,
  FileText,
  BookOpen,
  ArrowRight,
  Stethoscope,
  CheckCircle2,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

export default async function DashboardPage() {
  const locale = await getLocale();
  const format = await getFormatter();

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const isPhysician = user.role === 'doctor' || user.role === 'super_admin';

  // Fetch live stats for doctor
  const [patientCount, prescriptionCount, sourceCount, drugCount, recentPatientsList, activeNotices] = await Promise.all([
    isPhysician ? db.$count(patients, eq(patients.doctorId, user.id)) : 0,
    isPhysician ? db.$count(prescriptions, eq(prescriptions.doctorId, user.id)) : 0,
    db.$count(sources, eq(sources.status, 'active')),
    db.$count(drugs),
    isPhysician
      ? db.query.patients.findMany({
          where: eq(patients.doctorId, user.id),
          orderBy: [desc(patients.updatedAt)],
          limit: 5,
        })
      : [],
    db.select().from(medicineNotices).orderBy(desc(medicineNotices.publishedAt)).limit(3),
  ]);

  const decryptedRecentPatients = recentPatientsList.map((p) => ({
    ...p,
    name: decryptPatientPii(p.nameEncrypted),
    phone: decryptPatientPii(p.phoneEncrypted),
  }));

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
              ? 'ক্লিনিকাল প্র্যাকটিস ও ডিজিটাল প্রেসক্রিপশন সহকারী'
              : 'Clinical practice and digital prescription assistant'
          }
        />


        {/* 3 Unified Doctor Quick Action Cards */}
        {isPhysician && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. New Patient Intake */}
            <Link
              href="/patients/new"
              data-tour="dashboard-new-patient"
              className="group block p-5 rounded-xl bg-card border border-border hover:border-primary/50 shadow-xs transition-all text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-muted text-foreground flex items-center justify-center group-hover:text-primary transition-colors">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
                  {locale === 'bn' ? 'ধাপ ১/৪' : 'Step 1/4'}
                </Badge>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {locale === 'bn' ? 'নতুন রোগী' : 'New Patient'}
              </h3>
              <p className="text-xs text-muted-foreground leading-normal mb-3">
                {locale === 'bn'
                  ? 'নতুন রোগী নিবন্ধন ও ভাইটালস গ্রহণ করুন।'
                  : 'Start patient intake and record vitals.'}
              </p>
              <div className="flex items-center text-xs font-medium text-primary gap-1">
                <span>{locale === 'bn' ? 'শুরু করুন' : 'Start Intake'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* 2. Patient List / Registry */}
            <Link
              href="/patients"
              className="group block p-5 rounded-xl bg-card border border-border hover:border-primary/50 shadow-xs transition-all text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-muted text-foreground flex items-center justify-center group-hover:text-primary transition-colors">
                  <Users className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
                  {patientCount} {locale === 'bn' ? 'জন' : 'Patients'}
                </Badge>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {locale === 'bn' ? 'রোগীর তালিকা' : 'Patient List'}
              </h3>
              <p className="text-xs text-muted-foreground leading-normal mb-3">
                {locale === 'bn'
                  ? 'রোগীর প্রোফাইল ও পূর্বের প্রেসক্রিপশন দেখুন।'
                  : 'View patient records and consultations.'}
              </p>
              <div className="flex items-center text-xs font-medium text-primary gap-1">
                <span>{locale === 'bn' ? 'তালিকা দেখুন' : 'View Patients'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* 3. Search Library */}
            <Link
              href="/library"
              className="group block p-5 rounded-xl bg-card border border-border hover:border-primary/50 shadow-xs transition-all text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-muted text-foreground flex items-center justify-center group-hover:text-primary transition-colors">
                  <BookOpen className="w-5 h-5" />
                </div>
                <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
                  {sourceCount} {locale === 'bn' ? 'টি' : 'Sources'}
                </Badge>
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                {locale === 'bn' ? 'মেডিকেল লাইব্রেরি' : 'Medical Library'}
              </h3>
              <p className="text-xs text-muted-foreground leading-normal mb-3">
                {locale === 'bn'
                  ? 'ক্লিনিকাল গাইডলাইন ও ড্রাগ রেফারেন্স খুঁজুন।'
                  : 'Search verified clinical guidelines and drugs.'}
              </p>
              <div className="flex items-center text-xs font-medium text-primary gap-1">
                <span>{locale === 'bn' ? 'লাইব্রেরি খুলুন' : 'Open Library'}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          </div>
        )}

        {/* Summary Metric Cards */}
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

          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>{locale === 'bn' ? 'মেডিকেল গাইডলাইন' : 'Clinical Sources'}</span>
                <BookOpen className="w-4 h-4 text-muted-foreground" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground mt-1">
                {format.number(sourceCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
              {locale === 'bn' ? 'অনুমোদিত উৎস' : 'Verified sources'}
            </CardContent>
          </Card>

          <Card className="border border-border bg-card shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>{locale === 'bn' ? 'ফর্মুলারি ওষুধ' : 'Formulary Drugs'}</span>
                <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground mt-1">
                {format.number(drugCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
              {locale === 'bn' ? 'নিবন্ধিত ব্র্যান্ড' : 'Approved medicines'}
            </CardContent>
          </Card>
        </div>

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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {decryptedRecentPatients.map((p) => (
                  <Link key={p.id} href={`/patients/${p.id}`} className="block group">
                    <Card className="h-full border-border hover:border-primary/50 transition-all hover:shadow-xs bg-card">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            {p.patientCode}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(p.updatedAt).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US')}
                          </span>
                        </div>
                        <CardTitle className="text-lg font-bold text-foreground group-hover:text-primary transition-colors pt-2">
                          {p.name}
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          {p.age} {locale === 'bn' ? 'বছর' : 'yrs'} · {p.gender === 'female' ? (locale === 'bn' ? 'মহিলা' : 'Female') : (locale === 'bn' ? 'পুরুষ' : 'Male')} {p.bloodGroup ? `· রক্ত: ${p.bloodGroup}` : ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-5 pt-0 flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 mt-2">
                        <span>{p.phone || (locale === 'bn' ? 'ফোন নম্বর নেই' : 'No phone')}</span>
                        <span className="font-semibold text-primary flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          {locale === 'bn' ? 'প্রোফাইল' : 'Profile'}
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
