'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter, Link } from '@/i18n/routing';
import { useLocale, useTranslations } from 'next-intl';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { TextSizeControl } from './TextSizeControl';
import { HelpSheet } from './HelpSheet';
import { DemoBanner } from './DemoBanner';
import { GlobalSearchCommand } from './GlobalSearchCommand';
import { EvidenceSheet } from './EvidenceSheet';
import { Toaster } from '@/components/ui/sonner';
import { ProductTour, startProductTour } from './ProductTour';
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  FileText,
  BookOpen,
  HelpCircle,
  Settings,
  Search,
  LogOut,
  Stethoscope,
  ShieldAlert,
  Pill,
  Sparkles,
  GraduationCap,
  FlaskConical,
  HeartPulse,
} from 'lucide-react';
import { User } from '@/types';
import { cn } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tTour = useTranslations('tour');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });
    window.location.replace(`/${locale}/login`);
  };

  const role = currentUser?.role;

  const navItems = [
    ...(role === 'super_admin'
      ? [
          {
            title: t('admin'),
            href: '/admin',
            icon: ShieldAlert,
          },
        ]
      : []),
    ...(role === 'doctor' || role === 'super_admin'
      ? [
          {
            title: t('dashboard'),
            href: '/dashboard',
            icon: LayoutDashboard,
          },
          {
            title: t('patients'),
            href: '/patients',
            icon: Users,
          },
          {
            title: t('newCase'),
            href: '/patients/new',
            icon: PlusCircle,
          },
          {
            title: t('prescriptions'),
            href: '/prescriptions',
            icon: FileText,
          },
        ]
      : []),
    ...(role === 'patient'
      ? [
          {
            title: t('portal'),
            href: '/portal',
            icon: HeartPulse,
          },
          {
            title: t('prescriptions'),
            href: '/prescriptions',
            icon: FileText,
          },
        ]
      : []),
    ...(role === 'student' || role === 'super_admin'
      ? [
          {
            title: t('study'),
            href: '/study',
            icon: GraduationCap,
          },
        ]
      : []),
    ...(role === 'researcher' || role === 'super_admin'
      ? [
          {
            title: t('research'),
            href: '/research',
            icon: FlaskConical,
          },
        ]
      : []),
    ...(role === 'medicine_controller' || role === 'super_admin'
      ? [
          {
            title: t('controller'),
            href: '/controller',
            icon: Pill,
          },
        ]
      : []),
    ...(role !== 'patient'
      ? [
          {
            title: t('library'),
            href: '/library',
            icon: BookOpen,
          },
          {
            title: t('ask'),
            href: '/ask',
            icon: HelpCircle,
          },
        ]
      : []),
    {
      title: t('settings'),
      href: '/settings',
      icon: Settings,
    },
  ];

  const logoHref =
    role === 'super_admin'
      ? '/admin'
      : role === 'student'
      ? '/study'
      : role === 'researcher'
      ? '/research'
      : role === 'medicine_controller'
      ? '/controller'
      : role === 'patient'
      ? '/portal'
      : '/dashboard';

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background text-foreground">
          {/* Main App Sidebar */}
          <Sidebar collapsible="icon" role="complementary" aria-label={t('workspaceSidebar')} className="border-r border-border" data-tour="nav-sidebar">
            <SidebarHeader className="border-b border-border/60 p-4">
              <Link href={logoHref} className="flex items-center gap-3 group">
                <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-xs group-hover:scale-105 transition-transform">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <span className="font-bold text-base leading-tight tracking-tight text-foreground">
                    DocMate AI
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {locale === 'bn' ? 'ক্লিনিকাল ডিসিশন সাপোর্ট' : 'Clinical Decision Support'}
                  </span>
                </div>
              </Link>
            </SidebarHeader>

            <SidebarContent className="p-2">
              <nav aria-label={t('navigation')}>
                <SidebarGroup>
                  <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold px-2">
                    {locale === 'bn' ? 'প্রধান মেনু' : 'Clinical Workspace'}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-1">
                      {navItems.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          (item.href !== '/dashboard' && pathname.startsWith(item.href));
                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              render={<Link href={item.href} />}
                              isActive={isActive}
                              tooltip={item.title}
                              className={cn(
                                'text-sm font-medium rounded-md px-3 py-2 transition-colors',
                                isActive
                                  ? 'bg-primary text-primary-foreground hover:bg-primary/95 font-semibold shadow-xs'
                                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <item.icon className="w-4 h-4 shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </nav>
            </SidebarContent>

            <SidebarFooter className="border-t border-border/60 p-2.5 space-y-2">
              {/* Utility Tools: Tour, Help, Theme */}
              <div className="flex items-center justify-around group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1 py-1 px-1 rounded-lg bg-muted/40 border border-border/50">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => startProductTour()}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                  aria-label={tTour('startTour')}
                  title={tTour('startTour')}
                  data-tour="nav-tour-btn"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                </Button>

                <HelpSheet variant="icon" />

                <div data-tour="nav-theme">
                  <ThemeToggle variant="ghost" className="h-8 w-8 border-0" />
                </div>
              </div>

              {/* User Profile / Logout */}
              <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
                {currentUser ? (
                  <>
                    <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden overflow-hidden">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                        {currentUser.name.charAt(0)}
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-xs font-semibold truncate text-foreground">
                          {currentUser.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground uppercase font-medium">
                          {currentUser.role}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleLogout}
                      className="w-8 h-8 text-muted-foreground hover:text-destructive shrink-0"
                      title={t('logout')}
                      aria-label={t('logout')}
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
                    <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                      {locale === 'bn' ? 'লগইন করা নেই' : 'Not Signed In'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push('/login')}
                      className="text-xs h-7 px-2"
                    >
                      Sign In
                    </Button>
                  </div>
                )}
              </div>
            </SidebarFooter>
          </Sidebar>

          {/* Main Inset Content Area */}
          <SidebarInset className="flex flex-col flex-1 min-w-0">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-md sm:px-4 w-full max-w-full overflow-hidden">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
                <SidebarTrigger className="size-9 sm:size-10 text-muted-foreground hover:text-foreground shrink-0" aria-label={t('toggleSidebar')} />
                <button
                  type="button"
                  data-tour="nav-search"
                  onClick={() => {
                    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                    document.dispatchEvent(event);
                  }}
                  aria-label={t('search')}
                  className="flex size-9 sm:size-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-muted/40 text-xs text-muted-foreground hover:bg-muted/80 xl:w-auto xl:px-3"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden xl:inline">{t('search')}</span>
                </button>
                <div className="hidden 2xl:flex ml-2 shrink-0">
                  <DemoBanner variant="header" />
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div data-tour="nav-language" className="shrink-0">
                  <LanguageSwitcher />
                </div>

                {currentUser ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="size-8 sm:size-9 rounded-full bg-primary/15 hover:bg-primary/25 text-primary flex items-center justify-center text-xs font-bold ring-1 ring-border/80 hover:ring-primary/50 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={currentUser.name}
                          title={currentUser.name}
                        >
                          {currentUser.name.charAt(0)}
                        </button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold leading-none truncate">{currentUser.name}</p>
                            <Badge variant="outline" className="text-[9px] uppercase font-bold py-0 px-1 border-primary/30 text-primary shrink-0">
                              {currentUser.role}
                            </Badge>
                          </div>
                          <p className="text-[11px] leading-none text-muted-foreground truncate">{currentUser.email}</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer text-xs">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-xs text-destructive">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Log Out</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => router.push('/login')}
                    className="text-xs font-semibold h-8"
                  >
                    Sign In
                  </Button>
                )}
              </div>
            </header>

            {/* Page Body */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-16">
              {children}
            </main>

            {/* Persistent Mandatory Clinical Disclaimer */}
            <footer className="border-t border-border bg-card/60 px-4 py-3 text-center sm:px-6 no-print">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
                <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {tCommon('disclaimer')}
                </span>
                <span className="hidden sm:inline text-muted-foreground/40">•</span>
                <span className="text-[11px] text-muted-foreground">
                  {tCommon('doctorDecides')}
                </span>
              </div>
            </footer>
          </SidebarInset>
        </div>

        {/* Global Overlays */}
        <div className="sr-only">
          <TextSizeControl />
        </div>
        <GlobalSearchCommand role={currentUser?.role} />
        <EvidenceSheet />
        <ProductTour />
        <Toaster position="top-right" richColors />
      </SidebarProvider>
  );
}
