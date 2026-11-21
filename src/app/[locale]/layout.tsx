import type { Metadata } from 'next';
import { notoSansBengali, inter } from '@/app/fonts';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { EvidenceSheetProvider } from '@/context/EvidenceSheetContext';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'DocMate AI - Clinical Decision Support Assistant',
  description: 'Closed-library AI assistant for doctors with verified citations and deterministic safety checks.',
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
    <html
      lang={locale}
      className={`${notoSansBengali.variable} ${inter.variable} ${locale === 'bn' ? 'lang-bn' : ''}`}
      suppressHydrationWarning
    >
      <body className="font-sans min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider messages={messages} locale={locale}>
            <TooltipProvider delay={200}>
              <EvidenceSheetProvider>
                {children}
              </EvidenceSheetProvider>
            </TooltipProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
