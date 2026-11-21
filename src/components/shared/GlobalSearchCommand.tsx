'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { UserRole } from '@/types';

interface SearchResults {
  cases: { id: string; patientCode: string }[];
  sources: { id: string; title: string }[];
}

export function GlobalSearchCommand({ role }: { role?: UserRole }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [search, setSearch] = useState<{ query: string; results: SearchResults | null } | null>(null);
  const router = useRouter();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const query = value.trim();

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
        setValue('');
        setSearch(null);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (!open || query.length < 2 || !role) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const results = await response.json() as SearchResults;
        if (!controller.signal.aborted) setSearch({ query, results });
      } catch {
        if (!controller.signal.aborted) setSearch({ query, results: null });
      }
    }, 200);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query, role]);

  const navigate = (destination: string) => {
    setOpen(false);
    router.push(destination);
  };

  const navigation = [
    { path: '/dashboard', label: t('dashboard') },
    ...(role === 'doctor' || role === 'super_admin' ? [
      { path: '/cases', label: t('cases') },
      { path: '/cases/new', label: t('newCase') },
    ] : []),
    { path: '/library', label: t('library') },
    { path: '/ask', label: t('ask') },
    { path: '/settings', label: t('settings') },
  ];
  const searching = Boolean(role) && query.length >= 2;
  const current = searching && search?.query === query ? search : null;

  return (
    <CommandDialog title={t('commandTitle')} description={t('search')} open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('search')} aria-label={t('search')} value={value} maxLength={100}
        onValueChange={(next) => {
          setValue(next);
          setSearch(null);
        }} />
      <CommandList>
        {searching && !current ? (
          <p role="status" className="px-3 py-2 text-sm text-muted-foreground">{tCommon('loading')}</p>
        ) : current && !current.results ? (
          <p role="status" className="px-3 py-2 text-sm text-muted-foreground">{t('searchError')}</p>
        ) : <CommandEmpty>{t('noSearchResults')}</CommandEmpty>}
        <CommandGroup heading={t('navigation')}>
          {navigation.map(({ path, label }) => (
            <CommandItem key={path} value={label} onSelect={() => navigate(path)}>{label}</CommandItem>
          ))}
        </CommandGroup>
        {current?.results && current.results.cases.length > 0 && (
          <CommandGroup heading={t('cases')}>
            {current.results.cases.map(({ id, patientCode }) => (
              <CommandItem key={id} value={`${patientCode} ${id}`} onSelect={() => navigate(`/cases/${id}`)}>
                {patientCode}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {current?.results && current.results.sources.length > 0 && (
          <CommandGroup heading={t('library')}>
            {current.results.sources.map(({ id, title }) => (
              <CommandItem key={id} value={`${title} ${id}`} onSelect={() => navigate(`/library?source=${id}`)}>
                {title}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
