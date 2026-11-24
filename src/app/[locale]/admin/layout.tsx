import React from 'react';
import { getLocale } from 'next-intl/server';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shared/AppShell';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [locale, user] = await Promise.all([
    getLocale(),
    getCurrentUser(),
  ]);

  if (!user || user.role !== 'super_admin') {
    redirect(`/${locale}/dashboard`);
  }

  return <AppShell>{children}</AppShell>;
}
