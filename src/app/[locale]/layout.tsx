import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EvidenceSheetProvider } from '@/context/EvidenceSheetContext';

export const metadata: Metadata = {
  title: 'DocMate AI - Clinical Decision Support Assistant',
  description: 'Synthetic clinical workspace and internal medical library demo.',
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <NextIntlClientProvider messages={messages} locale={locale}>
        <TooltipProvider delay={200}>
          <EvidenceSheetProvider>{children}</EvidenceSheetProvider>
        </TooltipProvider>
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}
