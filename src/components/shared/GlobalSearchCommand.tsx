'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/routing';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { LayoutDashboard, Users, PlusCircle, BookOpen, HelpCircle, Settings } from 'lucide-react';

export function GlobalSearchCommand() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => void) => {
    setOpen(false);
    command();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search cases, library..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push('/dashboard'))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/cases'))}>
            <Users className="mr-2 h-4 w-4" />
            <span>Patient Cases</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/cases/new'))}>
            <PlusCircle className="mr-2 h-4 w-4" />
            <span>New Patient Intake</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/library'))}>
            <BookOpen className="mr-2 h-4 w-4" />
            <span>Medical Library</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/ask'))}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>Ask Library</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/settings'))}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Demo Cases">
          <CommandItem onSelect={() => runCommand(() => router.push('/cases'))}>
            <span>Case P-101 (Fever & Cough)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/cases'))}>
            <span>Case P-102 (Acute Chest Pain - Red Flag)</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push('/cases'))}>
            <span>Case P-103 (Insufficient Info Case)</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
