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
import { patients, prescriptions, sources, drugs } from '@/db/schema';
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
  AlertCircle,
} from 'lucide-react';

export default async function DashboardPage() {
  const tCommon = await getTranslations('common');
  const locale = await getLocale();
  const format = await getFormatter();

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const isPhysician = user.role === 'doctor' || user.role === 'super_admin';

  // Fetch live stats for doctor
  const [patientCount, prescriptionCount, sourceCount, drugCount, recentPatientsList] = await Promise.all([
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
  ]);

  const decryptedRecentPatients = recentPatientsList.map((p) => ({
    ...p,
    name: decryptPatientPii(p.nameEncrypted),
    phone: decryptPatientPii(p.phoneEncrypted),
  }));

  return (
    <AppShell>
      <div className="space-y-8 max-w-7xl mx-auto pb-12">
        {/* Persistent Clinical Disclaimer */}
        <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-xs text-primary font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-primary" />
            <span>{tCommon('disclaimer')}</span>
          </div>
          <span className="text-muted-foreground hidden sm:inline">{tCommon('doctorDecides')}</span>
        </div>

        {/* Doctor Header & Welcome */}
        <PageHeader
          title={
            locale === 'bn'
              ? `স্বাগতম, ${user.name}`
              : `Welcome, ${user.name}`
          }
          subtitle={
            locale === 'bn'
              ? 'ক্লিনিকাল প্র্যাকটিস ও বাংলাদেশি ডিজিটাল প্রেসক্রিপশন সহকারী'
              : 'Clinical practice and digital prescription support assistant'
          }
        />

        {/* 3 Senior-Friendly Giant Doctor Quick Action Cards */}
        {isPhysician && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. New Patient Intake */}
            <Link
              href="/patients/new"
              className="group block p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-card to-card border-2 border-primary/30 hover:border-primary shadow-sm hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <PlusCircle className="w-8 h-8" />
                </div>
                <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-background">
                  {locale === 'bn' ? 'ধাপ ১/৪' : 'Step 1/4'}
                </Badge>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                {locale === 'bn' ? 'নতুন রোগী গ্রহণ' : 'New Patient Intake'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {locale === 'bn'
                  ? 'রোগীর তথ্য, উপসর্গ, ভাইটাল সাইন ও পূর্বের ইতিহাস সহ দ্রুত নতুন কেস শুরু করুন।'
                  : 'Start a new patient intake with symptoms, vitals, and medical history.'}
              </p>
              <div className="flex items-center text-sm font-bold text-primary gap-1">
                <span>{locale === 'bn' ? 'রোগী গ্রহণ করুন' : 'Start Intake'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 2. Patient List / Registry */}
            <Link
              href="/patients"
              className="group block p-6 rounded-2xl bg-gradient-to-br from-teal-500/10 via-card to-card border-2 border-teal-500/30 hover:border-teal-500 shadow-sm hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Users className="w-8 h-8" />
                </div>
                <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-full">
                  {patientCount} {locale === 'bn' ? 'জন নিবন্ধিত' : 'Patients'}
                </span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                {locale === 'bn' ? 'রোগীর তালিকা' : 'Patient Registry'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {locale === 'bn'
                  ? 'আপনার চিকিৎসাধীন সকল রোগীর বিবরণ, পূর্বের ভিজিট এবং প্রেসক্রিপশন হিস্ট্রি দেখুন।'
                  : 'View all registered patients, consultation history, and prescriptions.'}
              </p>
              <div className="flex items-center text-sm font-bold text-teal-600 dark:text-teal-400 gap-1">
                <span>{locale === 'bn' ? 'তালিকা দেখুন' : 'View Registry'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>

            {/* 3. Search Library */}
            <Link
              href="/library"
              className="group block p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-card to-card border-2 border-indigo-500/30 hover:border-indigo-500 shadow-sm hover:shadow-md transition-all text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-14 h-14 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <BookOpen className="w-8 h-8" />
                </div>
                <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full">
                  {sourceCount} {locale === 'bn' ? 'টি রেফারেন্স' : 'Sources'}
                </span>
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {locale === 'bn' ? 'লাইব্রেরিতে অনুসন্ধান' : 'Search Medical Library'}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {locale === 'bn'
                  ? 'অনুমোদিত ক্লিনিকাল গাইডলাইন, ওষুধের মাত্রা এবং ড্রাগ ইন্টারঅ্যাকশন সরাসরি সার্চ করুন।'
                  : 'Search internal medical textbooks, guidelines, and drug formulary directly.'}
              </p>
              <div className="flex items-center text-sm font-bold text-indigo-600 dark:text-indigo-400 gap-1">
                <span>{locale === 'bn' ? 'লাইব্রেরি খুলুন' : 'Open Library'}</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{locale === 'bn' ? 'নিবন্ধিত রোগী' : 'Registered Patients'}</span>
                <Users className="w-4 h-4 text-primary" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {format.number(patientCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[12px] text-muted-foreground">
              {locale === 'bn' ? 'আপনার অধীনে সংরক্ষিত' : 'Under your direct care'}
            </CardContent>
          </Card>

          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{locale === 'bn' ? 'প্রেসক্রিপশন প্রস্তুত' : 'Prescriptions Issued'}</span>
                <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {format.number(prescriptionCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[12px] text-muted-foreground">
              {locale === 'bn' ? 'ডিজিটাল প্রেসক্রিপশন রেকর্ড' : 'BMDC compliant records'}
            </CardContent>
          </Card>

          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{locale === 'bn' ? 'মেডিকেল গাইডলাইন' : 'Clinical References'}</span>
                <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {format.number(sourceCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[12px] text-muted-foreground">
              {locale === 'bn' ? 'অনুমোদিত টেক্সটবুক ও গাইডলাইন' : 'Closed internal library'}
            </CardContent>
          </Card>

          <Card className="border-border shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>{locale === 'bn' ? 'ওষুধ ও ফর্মুলারি' : 'Formulary Records'}</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {format.number(drugCount)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[12px] text-muted-foreground">
              {locale === 'bn' ? 'নিরাপত্তা ও ইন্টারঅ্যাকশন ডেটাবেজ' : 'Deterministic safety rules'}
            </CardContent>
          </Card>
        </div>

        {/* Recently Seen Patients Section */}
        {isPhysician && (
          <div className="space-y-4">
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
