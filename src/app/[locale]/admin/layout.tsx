import React from 'react';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { AdminHeaderTour } from '@/components/admin/AdminHeaderTour';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Cpu,
  CreditCard,
  History,
  BookOpen,
  ShieldAlert,
  ArrowLeft,
} from 'lucide-react';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, t, user] = await Promise.all([
    getLocale(),
    getTranslations('admin'),
    getCurrentUser(),
  ]);

  if (!user || user.role !== 'super_admin') {
    redirect(`/${locale}/dashboard`);
  }

  const navItems = [
    { href: `/${locale}/admin`, label: t('dashboard'), icon: LayoutDashboard },
    { href: `/${locale}/admin/users`, label: t('users'), icon: Users },
    { href: `/${locale}/admin/access`, label: t('access'), icon: ShieldCheck },
    { href: `/${locale}/admin/ai`, label: t('ai'), icon: Cpu },
    { href: `/${locale}/admin/plans`, label: t('plans'), icon: CreditCard },
    { href: `/${locale}/admin/audit`, label: t('audit'), icon: History },
    { href: `/${locale}/admin/library`, label: t('library'), icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      {/* Top Admin Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/${locale}/dashboard`}
              className="p-2 -ml-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 text-xs font-medium"
              title={locale === 'bn' ? 'ক্লিনিকাল ড্যাশবোর্ডে ফিরুন' : 'Back to clinical workspace'}
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{locale === 'bn' ? 'ক্লিনিকাল স্পেস' : 'Clinical Space'}</span>
            </Link>

            <div className="h-5 w-px bg-border hidden sm:block" />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center font-bold">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-bold text-foreground tracking-tight leading-none">
                    {t('title')}
                  </h1>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-destructive/15 text-destructive font-bold">
                    Super Admin
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground hidden md:block leading-none mt-1">
                  {user.email}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AdminHeaderTour />
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="border-t border-border/60 bg-card/60 overflow-x-auto scrollbar-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 py-1 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all whitespace-nowrap"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Admin Page Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Persistent Clinical Decision Disclaimer */}
      <footer className="border-t border-border bg-card/50 py-3 text-center text-xs text-muted-foreground">
        <div className="max-w-7xl mx-auto px-4">
          {locale === 'bn'
            ? 'শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।'
            : 'Clinical decision support only. Not a substitute for professional judgement.'}
        </div>
      </footer>
    </div>
  );
}
