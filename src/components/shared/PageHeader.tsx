import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, badge, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-border/60', className)}>
      <div className="min-w-0 flex-1 basis-60 space-y-1 wrap-anywhere">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="text-sm text-muted-foreground leading-relaxed">{subtitle}</p>}
      </div>
      {action && <div className="flex max-w-full flex-wrap items-center gap-3">{action}</div>}
    </div>
  );
}
