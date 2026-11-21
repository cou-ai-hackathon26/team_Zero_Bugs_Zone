'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ChevronDown,
  ChevronUp,
  X,
  Crosshair,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { getStepsForPanel, startProductTour, TourStep } from './ProductTour';

interface OnboardingTourBlockProps {
  panel?: string;
  className?: string;
}

export function OnboardingTourBlock({ panel, className = '' }: OnboardingTourBlockProps) {
  const pathname = usePathname();
  const t = useTranslations('tour');

  // Derive panel key
  const getPanelKey = useCallback((): string => {
    if (panel) return panel;
    const clean = pathname.replace(/^\/(?:bn|en)(?:\/|$)/, '').replace(/^\//, '');
    const firstSegment = clean.split('/')[0] || 'landing';
    return firstSegment;
  }, [pathname, panel]);

  const resolvedPanel = getPanelKey();
  const steps: TourStep[] = getStepsForPanel(resolvedPanel);

  const [isDismissed, setIsDismissed] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [exploredSteps, setExploredSteps] = useState<number[]>([]);
  const [activeHighlightIndex, setActiveHighlightIndex] = useState<number | null>(null);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  // Sync state with localStorage on mount & panel change
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const dismissedKey = `docmate_onboarding_dismissed_${resolvedPanel}`;
        const collapsedKey = `docmate_onboarding_collapsed_${resolvedPanel}`;
        const exploredKey = `docmate_onboarding_explored_${resolvedPanel}`;

        setIsDismissed(localStorage.getItem(dismissedKey) === 'true');
        setIsCollapsed(localStorage.getItem(collapsedKey) === 'true');

        const savedExplored = localStorage.getItem(exploredKey);
        if (savedExplored) {
          setExploredSteps(JSON.parse(savedExplored));
        } else {
          setExploredSteps([]);
        }
      } catch {
        // localStorage may fail in private mode or SSR
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [resolvedPanel]);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(`docmate_onboarding_dismissed_${resolvedPanel}`, 'true');
    } catch {}
  };

  const handleRestore = () => {
    setIsDismissed(false);
    setIsCollapsed(false);
    try {
      localStorage.removeItem(`docmate_onboarding_dismissed_${resolvedPanel}`);
      localStorage.removeItem(`docmate_onboarding_collapsed_${resolvedPanel}`);
    } catch {}
  };

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem(`docmate_onboarding_collapsed_${resolvedPanel}`, String(next));
    } catch {}
  };

  // Highlighting specific target option
  const highlightOption = (index: number) => {
    const step = steps[index];
    if (!step) return;

    // Mark as explored
    if (!exploredSteps.includes(index)) {
      const updated = [...exploredSteps, index];
      setExploredSteps(updated);
      try {
        localStorage.setItem(`docmate_onboarding_explored_${resolvedPanel}`, JSON.stringify(updated));
      } catch {}
    }

    setActiveHighlightIndex(index);

    // If step targets the sidebar and it is currently collapsed, auto-expand it
    if (step.selector.includes('nav-sidebar')) {
      const trigger = document.querySelector('[data-slot="sidebar-trigger"]') as HTMLButtonElement | null;
      if (trigger && trigger.getAttribute('aria-expanded') === 'false') {
        trigger.click();
      }
    }

    const targetEl = document.querySelector(step.selector);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const recalculate = () => {
        const el = document.querySelector(step.selector);
        if (el) {
          setHighlightRect(el.getBoundingClientRect());
        }
      };
      recalculate();
      setTimeout(recalculate, 100);
      setTimeout(recalculate, 250);
      setTimeout(recalculate, 450);
    } else {
      setHighlightRect(null);
    }
  };

  const clearHighlight = useCallback(() => {
    setActiveHighlightIndex(null);
    setHighlightRect(null);
  }, []);

  // Update highlight position during scroll/resize
  useEffect(() => {
    if (activeHighlightIndex === null) return;
    const updatePos = () => {
      const step = steps[activeHighlightIndex];
      if (!step) return;
      const targetEl = document.querySelector(step.selector);
      if (targetEl) {
        setHighlightRect(targetEl.getBoundingClientRect());
      }
    };

    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [activeHighlightIndex, steps]);

  // Auto-dismiss highlight beacon after 7 seconds
  useEffect(() => {
    if (activeHighlightIndex === null) return;
    const timer = setTimeout(() => {
      clearHighlight();
    }, 7000);
    return () => clearTimeout(timer);
  }, [activeHighlightIndex, clearHighlight]);

  // Key listener to close highlight on Escape
  useEffect(() => {
    if (activeHighlightIndex === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearHighlight();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeHighlightIndex, clearHighlight]);

  if (steps.length === 0) return null;

  const totalSteps = steps.length;
  const progressPercent = Math.round((exploredSteps.length / totalSteps) * 100);

  // If dismissed, render a subtle un-dismiss pill trigger
  if (isDismissed) {
    return (
      <div className={`mb-4 flex items-center justify-end ${className}`}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRestore}
          className="gap-1.5 text-xs h-7 px-2.5 rounded-md bg-card border-border text-muted-foreground hover:text-foreground shadow-2xs"
          title={t('showGuide')}
        >
          <Compass className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{t('showGuide')}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            ({exploredSteps.length}/{totalSteps})
          </span>
        </Button>
      </div>
    );
  }

  return (
    <>
      {/* Onboarding Block Container */}
      <Card
        data-tour="onboarding-block"
        className={`mb-6 border border-border bg-card shadow-xs rounded-xl overflow-hidden ${className}`}
      >
        <CardContent className="p-4 sm:p-5">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4 text-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">
                    {t('onboardingTitle')}
                  </h3>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground font-normal">
                    {t('onboardingBadge')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('onboardingSubtitle')}
                </p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <div className="flex items-center gap-2 mr-1">
                <Progress value={progressPercent} className="w-16 sm:w-24 h-1.5 bg-muted" />
                <span className="text-[11px] text-muted-foreground font-mono">
                  {exploredSteps.length}/{totalSteps}
                </span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => startProductTour(resolvedPanel)}
                className="gap-1.5 text-xs h-7 px-2.5 font-medium"
              >
                <Compass className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('takeFullTour')}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapse}
                className="w-7 h-7 p-0 text-muted-foreground hover:text-foreground"
                aria-label={isCollapsed ? t('expand') : t('collapse')}
                title={isCollapsed ? t('expand') : t('collapse')}
              >
                {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="w-7 h-7 p-0 text-muted-foreground hover:text-foreground"
                aria-label={t('dismiss')}
                title={t('dismiss')}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Interactive Steps Grid (Collapsible) */}
          {!isCollapsed && (
            <div className="pt-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-200">
              {steps.map((step, idx) => {
                const isExplored = exploredSteps.includes(idx);
                const isCurrentlyActive = activeHighlightIndex === idx;

                return (
                  <div
                    key={`${step.selector}-${idx}`}
                    onClick={() => highlightOption(idx)}
                    className={`group relative p-3 rounded-lg border transition-all duration-150 cursor-pointer flex flex-col justify-between gap-2 ${
                      isCurrentlyActive
                        ? 'bg-accent/40 border-primary ring-1 ring-primary/40'
                        : 'bg-card border-border hover:border-foreground/30'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                          {idx + 1}
                        </span>
                        <h4 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                          {t(step.titleKey)}
                        </h4>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 leading-normal">
                        {t(step.descKey)}
                      </p>
                    </div>

                    <div className="pt-1.5 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 group-hover:text-primary transition-colors">
                        <Crosshair className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                        <span>{t('highlightOption')}</span>
                      </span>
                      {isExplored && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating Target Spotlight Ring & Callout Badge */}
      {activeHighlightIndex !== null && highlightRect && steps[activeHighlightIndex] && (
        <>
          {/* Subtle Focus Ring */}
          <div
            style={{
              position: 'fixed',
              top: Math.max(0, highlightRect.top - 4),
              left: Math.max(0, highlightRect.left - 4),
              width: highlightRect.width + 8,
              height: highlightRect.height + 8,
              zIndex: 9998,
              pointerEvents: 'none',
            }}
            className="rounded-lg border-2 border-primary ring-2 ring-primary/20 shadow-md transition-all duration-200"
          />

          {/* Interactive Floating Tooltip Callout */}
          <div
            style={{
              position: 'fixed',
              top:
                highlightRect.top > 100
                  ? highlightRect.top - 58
                  : Math.min(window.innerHeight - 90, highlightRect.bottom + 8),
              left: Math.max(16, Math.min(window.innerWidth - 300, highlightRect.left)),
              zIndex: 9999,
            }}
            className="bg-card text-foreground border border-border shadow-md rounded-lg p-2.5 max-w-xs flex items-start justify-between gap-2.5 animate-in fade-in zoom-in-95 duration-150"
            role="status"
          >
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground">
                  {t(steps[activeHighlightIndex].titleKey)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {t(steps[activeHighlightIndex].descKey)}
              </p>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={clearHighlight}
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
              aria-label={t('close')}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </>
      )}
    </>
  );
}
