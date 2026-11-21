'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Languages, Check } from 'lucide-react';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleSelect = (newLocale: 'bn' | 'en') => {
    if (newLocale === locale) return;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1 min-h-11 px-2.5 sm:px-3 text-xs font-medium border-border/80">
            <Languages className="w-4 h-4 text-primary shrink-0" />
            <span className="hidden sm:inline">{locale === 'bn' ? 'বাংলা (BN)' : 'English (EN)'}</span>
            <span className="sm:hidden uppercase">{locale}</span>
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem
          onClick={() => handleSelect('bn')}
          className="flex items-center justify-between cursor-pointer"
        >
          <span>বাংলা (Default)</span>
          {locale === 'bn' && <Check className="w-4 h-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleSelect('en')}
          className="flex items-center justify-between cursor-pointer"
        >
          <span>English</span>
          {locale === 'en' && <Check className="w-4 h-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
