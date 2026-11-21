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
} from 'lucide-react';
import { DoctorAiIllustration } from '@/components/shared/DoctorAiIllustration';
import { toast } from 'sonner';

export default function LandingPage() {
  const t = useTranslations('landing');
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loggingInRole, setLoggingInRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setIsLoggedIn(true);
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
      router.refresh();
    } catch {
      toast.error('Could not authenticate demo user');
    } finally {
      setLoggingInRole(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/20">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-2xs">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-sm sm:text-base leading-tight tracking-tight text-foreground">
                DocMate AI
              </span>
              <span className="text-[10px] text-muted-foreground font-normal hidden sm:block">
                {locale === 'bn' ? 'ক্লিনিকাল ডিসিশন সাপোর্ট' : 'Clinical Decision Support'}
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-muted-foreground">
            <a href="#how-it-works" className="hover:text-foreground transition-colors">
              {t('navHowItWorks')}
            </a>
            <a href="#standards" className="hover:text-foreground transition-colors">
              {t('navSafety')}
            </a>
            <a href="#scenarios" className="hover:text-foreground transition-colors">
              {t('navCases')}
            </a>
            <a href="#roles" className="hover:text-foreground transition-colors">
              {t('navRoles')}
            </a>
            <Link href="/library" className="hover:text-foreground transition-colors">
              {t('navLibrary')}
            </Link>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />

            {isLoggedIn ? (
              <Button
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="gap-1.5 text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
              >
                <span>{t('navDashboard')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => router.push('/login')}
                className="gap-1.5 text-xs font-medium h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs"
              >
                <span>{t('navSignIn')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-12 lg:py-16 border-b border-border/50 bg-background">
        {/* Subtle Decorative Vector Grid Background */}
        <div className="absolute inset-0 -z-10 opacity-15 dark:opacity-10 pointer-events-none">
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
            <div className="lg:col-span-7 space-y-5 text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-muted-foreground border border-border text-xs font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>{t('heroBadge')}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.2] text-foreground">
                {t('heroTitle')}
              </h1>

              <p className="text-base text-muted-foreground leading-relaxed max-w-2xl font-normal">
                {t('heroSubtitle')}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="default"
                  onClick={() => router.push('/cases/new')}
                  className="h-10 px-5 font-medium bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shadow-2xs rounded-md text-xs"
                >
                  <Stethoscope className="w-4 h-4" />
                  <span>{t('startIntake')}</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                </Button>

                <Button
                  size="default"
                  variant="outline"
                  onClick={() => router.push('/ask')}
                  className="h-10 px-4 font-medium border-border gap-2 bg-card hover:bg-muted rounded-md text-xs"
                >
                  <HelpCircle className="w-4 h-4 text-primary" />
                  <span>{t('askLibrary')}</span>
                </Button>

                <Button
                  size="default"
                  variant="ghost"
                  onClick={() => router.push('/library')}
                  className="h-10 px-4 font-medium text-muted-foreground hover:text-foreground rounded-md text-xs"
                >
                  <BookOpen className="w-4 h-4 mr-1.5" />
                  <span>{t('browseLibrary')}</span>
                </Button>
              </div>

              {/* Trust Badges */}
              <div className="grid grid-cols-3 gap-4 pt-5 border-t border-border/50 max-w-lg text-left">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                    <span>WHO & NICE</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === 'bn' ? 'অনুমোদিত গাইডলাইন' : 'Approved Guidelines'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                    <span>Safe Rx</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === 'bn' ? 'ড্রাগ সেফটি চেক' : 'Allergy & DDI Checks'}
                  </span>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-foreground font-semibold text-xs">
                    <UserCheck className="w-3.5 h-3.5 text-primary" />
                    <span>MD Decides</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground block">
                    {locale === 'bn' ? 'চিকিৎসকের সিদ্ধান্ত' : 'Physician in Control'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Doctor AI Assistant Vector Illustration */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <DoctorAiIllustration locale={locale} />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section (4 Simple Steps) */}
      <section id="how-it-works" className="py-14 bg-muted/20 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Step 1 */}
            <Card className="border-border bg-card shadow-2xs">
              <CardHeader className="space-y-2 pb-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <CardTitle className="text-sm font-semibold">
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
            <Card className="border-border bg-card shadow-2xs">
              <CardHeader className="space-y-2 pb-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <CardTitle className="text-sm font-semibold">
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
            <Card className="border-border bg-card shadow-2xs">
              <CardHeader className="space-y-2 pb-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <CardTitle className="text-sm font-semibold">
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
            <Card className="border-border bg-card shadow-2xs">
              <CardHeader className="space-y-2 pb-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <CardTitle className="text-sm font-semibold">
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
      <section id="standards" className="py-14 border-b border-border/50 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {locale === 'bn' ? 'ক্লিনিকাল গুণমান' : 'Clinical Standards'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('pillarsTitle')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('pillarsSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Standard 1 */}
            <Card className="border-border bg-card shadow-2xs">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar1Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar1Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 2 */}
            <Card className="border-border bg-card shadow-2xs">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <FileCheck2 className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar2Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar2Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 3 */}
            <Card className="border-border bg-card shadow-2xs">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <Pill className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar3Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar3Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 4 */}
            <Card className="border-border bg-card shadow-2xs">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar4Title')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {t('pillar4Desc')}
                </p>
              </CardContent>
            </Card>

            {/* Standard 5 */}
            <Card className="border-border bg-card shadow-2xs sm:col-span-2 lg:col-span-2">
              <CardHeader className="pb-2.5 space-y-2">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{t('pillar5Title')}</CardTitle>
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
      <section id="scenarios" className="py-14 bg-muted/20 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {locale === 'bn' ? 'ব্যবহারিক উদাহরণ' : 'Clinical Examples'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('demoCases')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('demoCasesSubtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Scenario A */}
            <Card className="border-border bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-medium">
                    Case P-101
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">Adult • 54Y</span>
                </div>
                <CardTitle className="text-sm font-semibold pt-1">{t('caseA')}</CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {t('caseADesc')}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push('/cases')}
                  className="w-full text-xs font-medium gap-1.5"
                >
                  <span>{t('viewCase')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardFooter>
            </Card>

            {/* Scenario B */}
            <Card className="border-border bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-medium">
                    Case P-102
                  </Badge>
                  <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px] font-medium">
                    Priority
                  </Badge>
                </div>
                <CardTitle className="text-sm font-semibold pt-1 text-foreground">
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
                  className="w-full text-xs font-medium gap-1.5"
                >
                  <span>{t('viewCase')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </CardFooter>
            </Card>

            {/* Scenario C */}
            <Card className="border-border bg-card shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-[10px] font-medium">
                    Case P-103
                  </Badge>
                  <Badge variant="secondary" className="text-[10px] font-medium">
                    Follow-Up
                  </Badge>
                </div>
                <CardTitle className="text-sm font-semibold pt-1 text-foreground">
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
                  className="w-full text-xs font-medium gap-1.5"
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
      <section id="roles" className="py-14 border-b border-border/50 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2.5">
            <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
              {locale === 'bn' ? 'ব্যবহারকারী ভূমিকা' : 'User Roles'}
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {t('personasTitle')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('personasSubtitle')}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Role 1: Doctor */}
            <Card className="border-border bg-card hover:border-primary/40 transition-colors shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{tAuth('doctorAccount')}</CardTitle>
                <CardDescription className="text-xs">
                  {locale === 'bn' ? 'রোগী গ্রহণ, রোগ নির্ণয় ও প্রেসক্রিপশন' : 'Clinical intake, diagnosis, and prescribing'}
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button
                  size="sm"
                  disabled={loggingInRole === 'doctor'}
                  onClick={() => handleQuickLogin('doctor@docmate.ai', '/dashboard', 'doctor')}
                  className="w-full text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {t('tryAsDoctor')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 2: Student */}
            <Card className="border-border bg-card hover:border-primary/40 transition-colors shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{tAuth('studentAccount')}</CardTitle>
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
                  className="w-full text-xs font-medium hover:bg-muted"
                >
                  {t('tryAsStudent')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 3: Researcher */}
            <Card className="border-border bg-card hover:border-primary/40 transition-colors shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <Microscope className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{tAuth('researcherAccount')}</CardTitle>
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
                  className="w-full text-xs font-medium hover:bg-muted"
                >
                  {t('tryAsResearcher')}
                </Button>
              </CardFooter>
            </Card>

            {/* Role 4: Admin */}
            <Card className="border-border bg-card hover:border-primary/40 transition-colors shadow-2xs flex flex-col justify-between">
              <CardHeader className="space-y-2 pb-3">
                <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center">
                  <UserCheck className="w-4 h-4 text-primary" />
                </div>
                <CardTitle className="text-sm font-semibold">{tAuth('adminAccount')}</CardTitle>
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
                  className="w-full text-xs font-medium hover:bg-muted"
                >
                  {t('tryAsAdmin')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* Persistent Disclaimer Footer */}
      <footer className="border-t border-border bg-card py-6 px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground mt-auto">
        <div className="max-w-4xl mx-auto space-y-1.5">
          <p className="flex items-center justify-center gap-1.5 font-semibold text-foreground">
            <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0" />
            <span>{tCommon('disclaimer')}</span>
          </p>
          <p className="text-[11px] opacity-80">{tCommon('doctorDecides')}</p>
          <p className="text-[10px] text-muted-foreground/60 pt-1">
            DocMate AI • Clinical Decision Support System
          </p>
        </div>
      </footer>
    </div>
  );
}
