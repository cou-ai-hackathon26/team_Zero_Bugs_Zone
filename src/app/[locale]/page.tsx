'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import {
  Stethoscope,
  ShieldCheck,
  ShieldAlert,
  BookOpen,
  FileCheck2,
  Pill,
  HelpCircle,
  GraduationCap,
  Microscope,
  UserCheck,
  ArrowRight,
  ChevronRight,
  HeartPulse,
  Activity,
  ClipboardList,
  Sparkles,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { toast } from 'sonner';

export default function LandingPage() {
  const t = useTranslations('landing');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [loggingInRole, setLoggingInRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setIsLoggedIn(true);
          setUserName(data.user.name);
        }
      })
      .catch(() => {});
  }, []);

  const handleQuickLogin = async (email: string, targetPath: string, roleName: string) => {
    setLoggingInRole(roleName);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'demo123' }),
      });

      if (!res.ok) {
        throw new Error('Quick login failed');
      }

      toast.success(
        locale === 'bn'
          ? `${roleName} হিসেবে সফলভাবে প্রবেশ করা হয়েছে`
          : `Signed in as ${roleName}`
      );
      router.push(targetPath);
    } catch {
      toast.error('Could not authenticate demo user');
    } finally {
      setLoggingInRole(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-teal-500 flex items-center justify-center text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base sm:text-lg leading-tight tracking-tight block">
                DocMate AI
              </span>
              <span className="text-[10px] sm:text-[11px] text-muted-foreground font-medium hidden sm:block">
                {locale === 'bn' ? 'ক্লিনিকাল ডিসিশন সাপোর্ট' : 'Clinical Decision Support'}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              {locale === 'bn' ? 'কার্যপদ্ধতি' : 'How It Works'}
            </a>
            <a href="#standards" className="hover:text-foreground transition-colors">
              {t('pillarsTitle')}
            </a>
            <a href="#scenarios" className="hover:text-foreground transition-colors">
              {t('demoCases')}
            </a>
            <a href="#roles" className="hover:text-foreground transition-colors">
              {t('personasTitle')}
            </a>
            <Link href="/library" className="hover:text-foreground transition-colors flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>{t('browseLibrary')}</span>
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />

            {isLoggedIn ? (
              <Button
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="gap-1.5 sm:gap-2 text-xs font-semibold h-9 px-2.5 sm:px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              >
                <span className="hidden sm:inline">{userName ? `${t('goToDashboard')} (${userName.split(' ')[0]})` : t('goToDashboard')}</span>
                <span className="sm:hidden">{t('goToDashboard')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => router.push('/login')}
                className="gap-1.5 sm:gap-2 text-xs font-semibold h-9 px-2.5 sm:px-4 bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              >
                <span>{t('signIn')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 lg:py-20 border-b border-border/40 bg-gradient-to-b from-primary/5 via-background to-background">
        {/* Subtle Decorative Vector Grid Background */}
        <div className="absolute inset-0 -z-10 opacity-30 dark:opacity-15 pointer-events-none">
          <svg className="w-full h-full" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-muted-foreground/30" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold shadow-2xs">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>{t('heroBadge')}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.2] text-foreground">
                {t('heroTitle')}
              </h1>

              <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl font-normal">
                {t('heroSubtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="lg"
                  onClick={() => router.push('/cases/new')}
                  className="h-12 px-6 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-sm rounded-lg"
                >
                  <Stethoscope className="w-5 h-5" />
                  <span>{t('startIntake')}</span>
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => router.push('/ask')}
                  className="h-12 px-5 font-semibold border-border gap-2 bg-card hover:bg-muted rounded-lg"
                >
                  <HelpCircle className="w-5 h-5 text-primary" />
                  <span>{t('askLibrary')}</span>
                </Button>

                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => router.push('/library')}
                  className="h-12 px-4 font-semibold text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  <span>{t('browseLibrary')}</span>
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/60 max-w-lg text-left">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-primary font-bold text-sm">
                    <BookOpen className="w-4 h-4" />
                    <span>WHO & NICE</span>
                  </div>
                  <span className="text-xs text-muted-foreground block">
                    {locale === 'bn' ? 'অনুমোদিত গাইডলাইন' : 'Approved Guidelines'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Safe Rx</span>
                  </div>
                  <span className="text-xs text-muted-foreground block">
                    {locale === 'bn' ? 'ড্রাগ সেফটি চেক' : 'Allergy & DDI Checks'}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-teal-600 font-bold text-sm">
                    <UserCheck className="w-4 h-4" />
                    <span>MD Decides</span>
                  </div>
                  <span className="text-xs text-muted-foreground block">
                    {locale === 'bn' ? 'চিকিৎসকের সিদ্ধান্ত' : 'Physician in Control'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: High-End Vector Illustration & Clinical Card */}
            <div className="lg:col-span-5 relative">
              {/* Decorative Vector Glow Circle */}
              <div className="absolute -top-10 -right-10 w-72 h-72 bg-primary/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative rounded-2xl border border-border/80 bg-card shadow-xl overflow-hidden">
                {/* Visual Header */}
                <div className="bg-gradient-to-r from-primary/10 via-teal-500/10 to-primary/5 border-b border-border/80 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-foreground block">
                        {locale === 'bn' ? 'ক্লিনিকাল ডিসিশন রিভিউ' : 'Clinical Decision Review'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {locale === 'bn' ? 'গাইডলাইন ও ড্রাগ সেফটি সারসংক্ষেপ' : 'Guideline & Safety Summary'}
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-background/80 font-mono border-primary/30 text-primary">
                    Verified
                  </Badge>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  {/* Real Clinical Presentation */}
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <ClipboardList className="w-3.5 h-3.5 text-primary" />
                        <span>{locale === 'bn' ? 'রোগীর প্রধান লক্ষণ' : 'Patient Symptoms'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">Adult • 54Y</span>
                    </div>
                    <p className="text-foreground font-medium text-xs leading-relaxed">
                      {locale === 'bn'
                        ? '৪ দিন ধরে তীব্র জ্বর, কফ এবং বুকে অস্বস্তি।'
                        : 'High fever for 4 days with productive cough and pleuritic discomfort.'}
                    </p>
                  </div>

                  {/* Differential & Guideline Match */}
                  <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-bold text-sm text-foreground">
                          {locale === 'bn' ? 'কমিউনিটি-অ্যাকওয়ার্ড নিউমোনিয়া (CAP)' : 'Community-Acquired Pneumonia'}
                        </span>
                      </div>
                      <Badge className="bg-emerald-600 text-white text-[10px] hover:bg-emerald-600">
                        {locale === 'bn' ? 'গাইডলাইন ম্যাচ' : 'Guideline Match'}
                      </Badge>
                    </div>

                    {/* Vector Citation Pill */}
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-background border border-border text-[11px] text-muted-foreground">
                      <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="truncate">
                        WHO Essential Medicines & Clinical Guidelines, Sec 6.2
                      </span>
                    </div>
                  </div>

                  {/* Formulary Safety Check */}
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-300 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-800 dark:text-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{locale === 'bn' ? 'ড্রাগ সেফটি স্ট্যাটাস' : 'Drug Safety Clearance'}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90 pl-5">
                      {locale === 'bn'
                        ? 'পেনিসিলিন অ্যালার্জি নেই • কোনো ক্ষতিকর ড্রাগ মিথস্ক্রিয়া নেই • স্বাভাবিক কিডনি মাত্রা।'
                        : 'No recorded penicillin allergy • Zero drug interactions • Normal renal dosing.'}
                    </p>
                  </div>

                  {/* Live Waveform SVG Graphic */}
                  <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/60">
                    <div className="flex items-center gap-1.5">
                      <HeartPulse className="w-4 h-4 text-rose-500 animate-pulse" />
                      <span className="font-medium">{locale === 'bn' ? 'স্বয়ংক্রিয় ক্লিনিকাল স্ক্রিনিং' : 'Real-Time Clinical Screening'}</span>
                    </div>
                    <span className="font-mono text-[10px] text-emerald-600 font-semibold">Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section (4 Simple Steps with Vector Artwork) */}
      <section id="how-it-works" className="py-16 bg-muted/20 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-bold">
              {locale === 'bn' ? 'সহজ চার ধাপের প্রক্রিয়া' : '4 Simple Steps'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {locale === 'bn' ? 'ডকমেট কীভাবে কাজ করে' : 'How DocMate AI Works'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {locale === 'bn'
                ? 'রোগীর লক্ষণ থেকে শুরু করে নিরাপদ চিকিৎসা নিশ্চিত করার সম্পূর্ণ ধাপ।'
                : 'From patient intake to verified treatment recommendations with physician control.'}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1 */}
            <Card className="border-border bg-card shadow-2xs relative">
              <CardHeader className="space-y-2 pb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <CardTitle className="text-base font-bold">
                  {locale === 'bn' ? 'লক্ষণ গ্রহণ' : '1. Patient Intake'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === 'bn'
                    ? 'রোগীর প্রধান লক্ষণ, অতীত ইতিহাস এবং ভাইটাল সাইন নথিভুক্ত করুন।'
                    : 'Record chief complaints, medical history, vitals, and current medicines.'}
                </p>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="border-border bg-card shadow-2xs relative">
              <CardHeader className="space-y-2 pb-2">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <CardTitle className="text-base font-bold">
                  {locale === 'bn' ? 'গাইডলাইন বিশ্লেষণ' : '2. Guideline Match'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === 'bn'
                    ? 'মেডিকেল লাইব্রেরি খুঁজে সংশ্লিষ্ট রোগের সম্ভাবনা ও প্রমাণ প্রদর্শন করে।'
                    : 'Searches internal clinical guidelines to suggest ranked differential diagnoses.'}
                </p>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="border-border bg-card shadow-2xs relative">
              <CardHeader className="space-y-2 pb-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <CardTitle className="text-base font-bold">
                  {locale === 'bn' ? 'সেফটি স্ক্রিনিং' : '3. Safety Engine'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === 'bn'
                    ? 'ওষুধের মাত্রা, অ্যালার্জি এবং ড্রাগ মিথস্ক্রিয়া স্বয়ংক্রিয়ভাবে যাচাই হয়।'
                    : 'Instant screening for allergies, harmful drug-drug interactions, and safe doses.'}
                </p>
              </CardContent>
            </Card>

            {/* Step 4 */}
            <Card className="border-border bg-card shadow-2xs relative">
              <CardHeader className="space-y-2 pb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <CardTitle className="text-base font-bold">
                  {locale === 'bn' ? 'চিকিৎসকের সিদ্ধান্ত' : '4. Doctor Signs'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {locale === 'bn'
                    ? 'চিকিৎসক চূড়ান্ত সিদ্ধান্ত নেন এবং প্রেসক্রিপশন সামারি প্রিন্ট করেন।'
                    : 'The physician reviews, confirms diagnosis, and finalizes the care plan.'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Core Safety Standards Section */}
      <section id="standards" className="py-16 border-b border-border/60 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-bold">
              {locale === 'bn' ? 'ক্লিনিকাল গুণমান' : 'Clinical Standards'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('pillarsTitle')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('pillarsSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Standard 1 */}
            <Card className="border-border bg-card shadow-2xs hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold">{t('pillar1Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar1Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 2 */}
            <Card className="border-border bg-card shadow-2xs hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold">{t('pillar2Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar2Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 3 */}
            <Card className="border-border bg-card shadow-2xs hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <Pill className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold">{t('pillar3Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar3Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 4 */}
            <Card className="border-border bg-card shadow-2xs hover:shadow-sm transition-shadow">
              <CardHeader className="pb-3 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold">{t('pillar4Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar4Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 5 */}
            <Card className="border-border bg-card shadow-2xs hover:shadow-sm transition-shadow sm:col-span-2 lg:col-span-2">
              <CardHeader className="pb-3 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <CardTitle className="text-base font-bold">{t('pillar5Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar5Desc')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Clinical Scenarios Section */}
      <section id="scenarios" className="py-16 bg-muted/20 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-bold">
              {locale === 'bn' ? 'ব্যবহারিক উদাহরণ' : 'Clinical Examples'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('demoCases')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('demoCasesSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Scenario A */}
            <Card className="border-border bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                    Case P-101
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">Adult • 54Y</span>
                </div>
                <CardTitle className="text-base font-bold pt-1">{t('caseA')}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {t('caseADesc')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/cases')}
                  className="w-full text-xs font-semibold gap-1.5"
                >
                  <span>{t('viewCase')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardFooter>
            </Card>

            {/* Scenario B */}
            <Card className="border-destructive/30 bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive bg-destructive/5">
                    Case P-102
                  </Badge>
                  <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                    Priority
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold pt-1 text-destructive">
                  {t('caseB')}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {t('caseBDesc')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/cases')}
                  className="w-full text-xs font-semibold gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5"
                >
                  <span>{t('viewCase')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardFooter>
            </Card>

            {/* Scenario C */}
            <Card className="border-amber-500/30 bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/5">
                    Case P-103
                  </Badge>
                  <Badge className="bg-amber-500 text-white text-[10px]">
                    Follow-Up
                  </Badge>
                </div>
                <CardTitle className="text-base font-bold pt-1 text-amber-800 dark:text-amber-300">
                  {t('caseC')}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed text-muted-foreground">
                  {t('caseCDesc')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/cases')}
                  className="w-full text-xs font-semibold gap-1.5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/5"
                >
                  <span>{t('viewCase')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Roles Section */}
      <section id="roles" className="py-16 border-b border-border/60 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-bold">
              {locale === 'bn' ? 'ব্যবহারকারী ভূমিকা' : 'User Roles'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('personasTitle')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('personasSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Role 1: Doctor */}
            <Card className="border-primary/40 bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <CardTitle className="text-sm font-bold">{tAuth('doctorAccount')}</CardTitle>
                <CardDescription className="text-xs">
                  {locale === 'bn' ? 'রোগী গ্রহণ, রোগ নির্ণয় ও প্রেসক্রিপশন' : 'Clinical intake, diagnosis, and prescribing'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  disabled={loggingInRole === 'doctor'}
                  onClick={() => handleQuickLogin('doctor@docmate.ai', '/dashboard', 'doctor')}
                  className="w-full text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t('tryAsDoctor')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 2: Student */}
            <Card className="border-indigo-500/30 bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <CardTitle className="text-sm font-bold">{tAuth('studentAccount')}</CardTitle>
                <CardDescription className="text-xs">
                  {locale === 'bn' ? 'মেডিকেল কেস স্টাডি ও গাইডলাইন শিক্ষা' : 'Trainee learning and guideline exploration'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loggingInRole === 'student'}
                  onClick={() => handleQuickLogin('student@docmate.ai', '/ask', 'student')}
                  className="w-full text-xs font-semibold border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/5"
                >
                  {t('tryAsStudent')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 3: Researcher */}
            <Card className="border-teal-500/30 bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-600 flex items-center justify-center">
                  <Microscope className="w-5 h-5" />
                </div>
                <CardTitle className="text-sm font-bold">{tAuth('researcherAccount')}</CardTitle>
                <CardDescription className="text-xs">
                  {locale === 'bn' ? 'চিকিৎসা গবেষণা ও তথ্যের উৎস অনুসন্ধান' : 'Evidence search and literature evaluation'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loggingInRole === 'researcher'}
                  onClick={() => handleQuickLogin('researcher@docmate.ai', '/library', 'researcher')}
                  className="w-full text-xs font-semibold border-teal-500/30 text-teal-600 hover:bg-teal-500/5"
                >
                  {t('tryAsResearcher')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 4: Admin */}
            <Card className="border-amber-500/30 bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <CardTitle className="text-sm font-bold">{tAuth('adminAccount')}</CardTitle>
                <CardDescription className="text-xs">
                  {locale === 'bn' ? 'গাইডলাইন নিবন্ধন ও হাসপাতাল পরিচালনা' : 'Formulary management and system oversight'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loggingInRole === 'admin'}
                  onClick={() => handleQuickLogin('admin@docmate.ai', '/library', 'admin')}
                  className="w-full text-xs font-semibold border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/5"
                >
                  {t('tryAsAdmin')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Persistent Disclaimer Footer */}
      <footer className="border-t border-border bg-card/80 py-8 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground mt-auto">
        <div className="max-w-4xl mx-auto space-y-2">
          <p className="flex items-center justify-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{tCommon('disclaimer')}</span>
          </p>
          <p className="text-[11px] opacity-80">{tCommon('doctorDecides')}</p>
          <p className="text-[10px] text-muted-foreground/60 pt-2">
            DocMate AI • Clinical Decision Support System
          </p>
        </div>
      </footer>
    </div>
  );
}
