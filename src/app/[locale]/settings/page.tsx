import React from 'react';
import { AppShell } from '@/components/shared/AppShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { getCurrentUser } from '@/lib/auth';
import { ShieldCheck, UserCheck, Database, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <PageHeader
          title="Settings & System Status"
          subtitle="Configure language preferences, visual theme, and inspect internal medical engine status."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Preferences */}
          <Card className="border-border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <span>Localization & Appearance</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Switch language between Bengali (বাংলা) and English, and toggle themes.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border/60">
                <div>
                  <h4 className="text-sm font-medium">Interface Language</h4>
                  <p className="text-xs text-muted-foreground">Default: বাংলা (bn)</p>
                </div>
                <LanguageSwitcher />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <h4 className="text-sm font-medium">Visual Theme</h4>
                  <p className="text-xs text-muted-foreground">Light, Dark, or System Sync</p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>

          {/* User Profile */}
          <Card className="border-border">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                <span>Active Clinician Profile</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Current authenticated healthcare professional session.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-3">
              <div className="p-3 rounded-lg bg-muted/40 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Name:</span>
                  <span className="text-xs font-semibold text-foreground">{user?.name || 'Dr. Farhana Rahman'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Email:</span>
                  <span className="text-xs font-mono text-foreground">{user?.email || 'doctor@docmate.ai'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Role:</span>
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/30">
                    {user?.role || 'doctor'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engine & Database Status */}
          <Card className="border-border md:col-span-2">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <span>Clinical Engine & Architecture Status</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Verification status of internal medical databases and closed library pipelines.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>PostgreSQL + pgvector</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Connected. Hybrid vector similarity & full-text search active.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Closed Library Isolation</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Strict prompt boundaries enforced. No outside web retrieval.
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Deterministic Drug Engine</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    TypeScript rule engine active for interactions, renal & allergies.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
