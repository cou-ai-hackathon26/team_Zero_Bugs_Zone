'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { ProductTour, startProductTour } from '@/components/shared/ProductTour';

export function AdminHeaderTour() {
  const tTour = useTranslations('tour');

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => startProductTour('admin')}
        className="gap-1.5 text-xs h-8 px-2.5 border-border hover:bg-muted text-foreground font-medium"
        aria-label={tTour('startTour')}
        title={tTour('startTour')}
        data-tour="nav-tour-btn"
      >
        <Sparkles className="w-3.5 h-3.5 text-destructive" />
        <span className="hidden sm:inline">{tTour('startTour')}</span>
      </Button>
      <ProductTour />
    </div>
  );
}
