'use client';

import React, { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { Stethoscope, ShieldCheck, UserCheck, GraduationCap, Microscope, ShieldAlert, ArrowRight, Loader2, Pill, HeartHandshake } from 'lucide-react';
import { toast } from 'sonner';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const demoAccounts = [
    {
      role: 'doctor',
      title: t('doctorAccount'),
      email: 'doctor@docmate.ai',
      icon: Stethoscope,
    },
    {
      role: 'patient',
      title: t('patientAccount'),
      email: 'patient@docmate.ai',
      icon: HeartHandshake,
    },
    {
      role: 'controller',
      title: t('controllerAccount'),
      email: 'controller@docmate.ai',
      icon: Pill,
    },
    {
      role: 'student',
      title: t('studentAccount'),
      email: 'student@docmate.ai',
      icon: GraduationCap,
    },
    {
      role: 'researcher',
      title: t('researcherAccount'),
      email: 'researcher@docmate.ai',
      icon: Microscope,
    },
    {
      role: 'super_admin',
      title: t('adminAccount'),
      email: 'admin@docmate.ai',
      icon: ShieldAlert,
    },
  ];

  const handleSelectDemo = (accEmail: string) => {
    setEmail(accEmail);
    setPassword('demo123');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
        credentials: 'same-origin',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t('errorInvalid'));
      }

      toast.success(t('signedIn'));

      // Check callbackUrl in URL search parameters
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const callback = params?.get('callbackUrl');

      const role = data.user?.role;
      const defaultPath = role === 'student' ? '/ask' : role === 'researcher' ? '/library' : '/dashboard';
      const targetUrl = callback && callback.startsWith('/') ? callback : `/${locale}${defaultPath}`;

      // In Safari on macOS (WebKit), client-side router.push() makes an asynchronous fetch for the RSC payload.
      // WebKit's network process often does not attach SameSite=Lax cookies to that immediate second fetch,
      // which causes Next.js middleware to bounce back to /login.
      // Top-level document navigation via window.location.replace forces Safari to commit the cookie jar and
      // attach the session cookie on the document request.
      window.location.replace(targetUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('errorInvalid');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-muted/20 p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <header className="flex items-center justify-between max-w-5xl mx-auto w-full pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight text-foreground">
              DocMate AI
            </h1>
            <p className="text-xs text-muted-foreground font-medium">
              {tCommon('appTagline')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Login Card */}
      <main className="max-w-md mx-auto w-full my-auto py-6">
        <Card className="border-border shadow-md bg-card">
          <CardHeader className="space-y-1.5 pb-4 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {t('title')}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              {t('subtitle')}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Quick Demo Account Selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('demoAccounts')}
                </Label>
                <span className="text-[11px] font-mono text-muted-foreground bg-muted/80 border border-border/60 px-2 py-0.5 rounded font-medium">
                  {locale === 'bn' ? 'পাসওয়ার্ড: demo123' : 'Password: demo123'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {demoAccounts.map((acc) => {
                  const isSelected = email === acc.email;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleSelectDemo(acc.email)}
                      className={`flex flex-col items-start p-2.5 rounded-lg border text-left transition-all text-xs font-medium ${
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary/40 shadow-2xs'
                          : 'border-border bg-card/60 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-start gap-1.5 mb-1">
                        <acc.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="wrap-anywhere">{acc.title}</span>
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground wrap-anywhere">{acc.email}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {error && (
              <div className="p-3 text-xs rounded-md bg-destructive/10 border border-destructive/30 text-destructive flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  {t('email')}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@docmate.ai"
                  required
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">
                  {t('password')}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="demo123"
                  required
                  className="h-9 text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-10 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t('signingIn')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('signIn')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="pt-2 pb-6 border-t border-border/60 text-center flex flex-col gap-1">
            <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{t('closedLibrary')}</span>
            </span>
          </CardFooter>
        </Card>
      </main>

      {/* Mandatory Disclaimer Footer */}
      <footer className="max-w-2xl mx-auto text-center text-xs text-muted-foreground pt-4">
        <p className="font-medium text-amber-700 dark:text-amber-400">
          {tCommon('disclaimer')}
        </p>
        <p className="text-[11px] mt-0.5">{tCommon('doctorDecides')}</p>
      </footer>
    </div>
  );
}
