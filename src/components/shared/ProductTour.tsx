'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  Compass,
} from 'lucide-react';

export interface TourStep {
  selector: string;
  titleKey: string;
  descKey: string;
}

export function startProductTour(panelKey?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('docmate:start-tour', { detail: { panel: panelKey } }));
  }
}

// Define steps per panel as a pure exported function
export function getStepsForPanel(panel: string): TourStep[] {
  switch (panel) {
    case 'landing':
    case '':
      return [
        {
          selector: '[data-tour="landing-hero"]',
          titleKey: 'landingHeroTitle',
          descKey: 'landingHeroDesc',
        },
        {
          selector: '[data-tour="landing-how-it-works"]',
          titleKey: 'landingHowItWorksTitle',
          descKey: 'landingHowItWorksDesc',
        },
        {
          selector: '[data-tour="landing-safety"]',
          titleKey: 'landingSafetyTitle',
          descKey: 'landingSafetyDesc',
        },
        {
          selector: '[data-tour="landing-roles"]',
          titleKey: 'landingRolesTitle',
          descKey: 'landingRolesDesc',
        },
        {
          selector: '[data-tour="landing-signin"]',
          titleKey: 'landingSignInTitle',
          descKey: 'landingSignInDesc',
        },
      ];
    case 'dashboard':
      return [
        {
          selector: '[data-tour="nav-sidebar"]',
          titleKey: 'globalSidebarTitle',
          descKey: 'globalSidebarDesc',
        },
        {
          selector: '[data-tour="dashboard-stats"]',
          titleKey: 'dashboardStatsTitle',
          descKey: 'dashboardStatsDesc',
        },
        {
          selector: '[data-tour="dashboard-new-patient"]',
          titleKey: 'dashboardNewPatientTitle',
          descKey: 'dashboardNewPatientDesc',
        },
        {
          selector: '[data-tour="dashboard-recent"]',
          titleKey: 'dashboardRecentTitle',
          descKey: 'dashboardRecentDesc',
        },
        {
          selector: '[data-tour="nav-search"]',
          titleKey: 'globalSearchTitle',
          descKey: 'globalSearchDesc',
        },
      ];
    case 'patients':
      return [
        {
          selector: '[data-tour="patients-search"]',
          titleKey: 'patientsSearchTitle',
          descKey: 'patientsSearchDesc',
        },
        {
          selector: '[data-tour="patients-new-btn"]',
          titleKey: 'patientsNewBtnTitle',
          descKey: 'patientsNewBtnDesc',
        },
        {
          selector: '[data-tour="patients-list"]',
          titleKey: 'dashboardRecentTitle',
          descKey: 'patientsSearchDesc',
        },
        {
          selector: '[data-tour="nav-sidebar"]',
          titleKey: 'globalSidebarTitle',
          descKey: 'globalSidebarDesc',
        },
      ];
    case 'prescriptions':
      return [
        {
          selector: '[data-tour="rx-search"]',
          titleKey: 'rxSearchTitle',
          descKey: 'rxSearchDesc',
        },
        {
          selector: '[data-tour="rx-filter"]',
          titleKey: 'rxFilterTitle',
          descKey: 'rxFilterDesc',
        },
        {
          selector: '[data-tour="rx-list"]',
          titleKey: 'rxSearchTitle',
          descKey: 'rxSearchDesc',
        },
      ];
    case 'library':
      return [
        {
          selector: '[data-tour="library-search"]',
          titleKey: 'librarySearchTitle',
          descKey: 'librarySearchDesc',
        },
        {
          selector: '[data-tour="library-sources"]',
          titleKey: 'librarySourcesTitle',
          descKey: 'librarySourcesDesc',
        },
        {
          selector: '[data-tour="nav-search"]',
          titleKey: 'globalSearchTitle',
          descKey: 'globalSearchDesc',
        },
      ];
    case 'ask':
      return [
        {
          selector: '[data-tour="ask-input"]',
          titleKey: 'askInputTitle',
          descKey: 'askInputDesc',
        },
        {
          selector: '[data-tour="ask-citations"]',
          titleKey: 'askCitationsTitle',
          descKey: 'askCitationsDesc',
        },
        {
          selector: '[data-tour="nav-sidebar"]',
          titleKey: 'globalSidebarTitle',
          descKey: 'globalSidebarDesc',
        },
      ];
    case 'admin':
      return [
        {
          selector: '[data-tour="admin-stats"]',
          titleKey: 'adminStatsTitle',
          descKey: 'adminStatsDesc',
        },
        {
          selector: '[data-tour="admin-killswitches"]',
          titleKey: 'adminKillswitchesTitle',
          descKey: 'adminKillswitchesDesc',
        },
        {
          selector: '[data-tour="admin-audit"]',
          titleKey: 'adminAuditTitle',
          descKey: 'adminAuditDesc',
        },
      ];
    case 'portal':
      return [
        {
          selector: '[data-tour="portal-profile"]',
          titleKey: 'portalProfileTitle',
          descKey: 'portalProfileDesc',
        },
        {
          selector: '[data-tour="portal-tabs"]',
          titleKey: 'portalTabsTitle',
          descKey: 'portalTabsDesc',
        },
        {
          selector: '[data-tour="portal-schedule"]',
          titleKey: 'portalScheduleTitle',
          descKey: 'portalScheduleDesc',
        },
        {
          selector: '[data-tour="portal-consent"]',
          titleKey: 'portalConsentTitle',
          descKey: 'portalConsentDesc',
        },
      ];
    case 'study':
      return [
        {
          selector: '[data-tour="study-cases"]',
          titleKey: 'studyCasesTitle',
          descKey: 'studyCasesDesc',
        },
        {
          selector: '[data-tour="study-quizzes"]',
          titleKey: 'studyQuizzesTitle',
          descKey: 'studyQuizzesDesc',
        },
        {
          selector: '[data-tour="study-notes"]',
          titleKey: 'studyNotesTitle',
          descKey: 'studyNotesDesc',
        },
        {
          selector: '[data-tour="study-library-qa"]',
          titleKey: 'studyLibraryTitle',
          descKey: 'studyLibraryDesc',
        },
      ];
    case 'research':
      return [
        {
          selector: '[data-tour="research-search"]',
          titleKey: 'researchSearchTitle',
          descKey: 'researchSearchDesc',
        },
        {
          selector: '[data-tour="research-compare"]',
          titleKey: 'researchCompareTitle',
          descKey: 'researchCompareDesc',
        },
        {
          selector: '[data-tour="research-collections"]',
          titleKey: 'researchCollectionsTitle',
          descKey: 'researchCollectionsDesc',
        },
        {
          selector: '[data-tour="research-export"]',
          titleKey: 'researchExportTitle',
          descKey: 'researchExportDesc',
        },
      ];
    case 'controller':
      return [
        {
          selector: '[data-tour="controller-stats"]',
          titleKey: 'controllerStatsTitle',
          descKey: 'controllerStatsDesc',
        },
        {
          selector: '[data-tour="controller-formulary"]',
          titleKey: 'controllerFormularyTitle',
          descKey: 'controllerFormularyDesc',
        },
        {
          selector: '[data-tour="controller-review"]',
          titleKey: 'controllerReviewTitle',
          descKey: 'controllerReviewDesc',
        },
        {
          selector: '[data-tour="controller-notices"]',
          titleKey: 'controllerNoticesTitle',
          descKey: 'controllerNoticesDesc',
        },
      ];
    default:
      return [
        {
          selector: '[data-tour="nav-sidebar"]',
          titleKey: 'globalSidebarTitle',
          descKey: 'globalSidebarDesc',
        },
        {
          selector: '[data-tour="nav-search"]',
          titleKey: 'globalSearchTitle',
          descKey: 'globalSearchDesc',
        },
        {
          selector: '[data-tour="nav-language"]',
          titleKey: 'globalLangTitle',
          descKey: 'globalLangDesc',
        },
      ];
  }
}

export function ProductTour() {
  const pathname = usePathname();
  const t = useTranslations('tour');

  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [forcedPanel, setForcedPanel] = useState<string | null>(null);

  // Reset forced panel and close on route change
  useEffect(() => {
    const timer = setTimeout(() => {
      setForcedPanel(null);
      setIsOpen(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Normalize panel key from current pathname
  const getPanelKey = useCallback((): string => {
    if (forcedPanel) return forcedPanel;
    const clean = pathname.replace(/^\/(?:bn|en)(?:\/|$)/, '').replace(/^\//, '');
    const firstSegment = clean.split('/')[0] || 'landing';
    return firstSegment;
  }, [pathname, forcedPanel]);

  const panelKey = getPanelKey();
  const steps = getStepsForPanel(panelKey);

  // Position calculation and scroll into view with staged sync
  const updateTargetPosition = useCallback(() => {
    if (!isOpen || !steps[currentStep]) return;
    const step = steps[currentStep];

    // If step targets the sidebar and it is currently collapsed, auto-expand it
    if (step.selector.includes('nav-sidebar')) {
      const trigger = document.querySelector('[data-slot="sidebar-trigger"]') as HTMLButtonElement | null;
      if (trigger && trigger.getAttribute('aria-expanded') === 'false') {
        trigger.click();
      }
    }

    const target = document.querySelector(step.selector);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const recalculate = () => {
        const el = document.querySelector(step.selector);
        if (el) {
          setTargetRect(el.getBoundingClientRect());
        }
      };
      recalculate();
      const t1 = setTimeout(recalculate, 100);
      const t2 = setTimeout(recalculate, 250);
      const t3 = setTimeout(recalculate, 450);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      setTargetRect(null);
    }
  }, [isOpen, steps, currentStep]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateTargetPosition();
    }, 0);

    // On scroll/resize, ONLY recalculate bounding rect without re-invoking scrollIntoView
    const handleReposition = () => {
      if (!isOpen || !steps[currentStep]) return;
      const target = document.querySelector(steps[currentStep].selector);
      if (target) {
        setTargetRect(target.getBoundingClientRect());
      }
    };

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, steps, currentStep, updateTargetPosition]);

  // Listen for custom trigger event
  useEffect(() => {
    const handleStartTour = (e: Event) => {
      const customEvent = e as CustomEvent<{ panel?: string }>;
      if (customEvent.detail?.panel) {
        setForcedPanel(customEvent.detail.panel);
      }
      setCurrentStep(0);
      setIsOpen(true);
    };
    window.addEventListener('docmate:start-tour', handleStartTour);
    return () => window.removeEventListener('docmate:start-tour', handleStartTour);
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      } else if (e.key === 'ArrowRight') {
        if (currentStep < steps.length - 1) {
          setCurrentStep((prev) => prev + 1);
        } else {
          setIsOpen(false);
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStep > 0) {
          setCurrentStep((prev) => prev - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, steps.length]);

  if (!isOpen || steps.length === 0) return null;

  const currentStepData = steps[currentStep];
  const progressPercent = Math.round(((currentStep + 1) / steps.length) * 100);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      setIsOpen(false);
      try {
        localStorage.setItem(`docmate_tour_${panelKey}`, 'seen');
      } catch {}
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    try {
      localStorage.setItem(`docmate_tour_${panelKey}`, 'seen');
    } catch {}
  };

  // Determine card placement relative to targetRect
  let cardPositionStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 60,
  };

  if (targetRect && typeof window !== 'undefined') {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      cardPositionStyle = {
        position: 'fixed',
        bottom: '24px',
        left: '16px',
        right: '16px',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 60,
      };
    } else {
      const spaceBelow = window.innerHeight - targetRect.bottom;
      const spaceAbove = targetRect.top;
      const spaceRight = window.innerWidth - targetRect.right;

      let top = targetRect.bottom + 16;
      let left = Math.max(16, Math.min(targetRect.left, window.innerWidth - 400));

      if (spaceBelow < 240 && spaceAbove > 240) {
        top = Math.max(16, targetRect.top - 240);
      } else if (spaceRight > 420 && targetRect.width < 300) {
        top = Math.max(16, targetRect.top);
        left = targetRect.right + 16;
      }

      cardPositionStyle = {
        position: 'fixed',
        top: `${Math.min(top, window.innerHeight - 280)}px`,
        left: `${left}px`,
        width: '380px',
        maxWidth: '92vw',
        zIndex: 60,
      };
    }
  } else {
    // Center in viewport if target element is not found
    cardPositionStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '380px',
      maxWidth: '92vw',
      zIndex: 60,
    };
  }

  return (
    <>
      {/* Dark Spotlight Backdrop Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] transition-opacity duration-300"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Target Element Highlight Box */}
      {targetRect && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg ring-4 ring-primary ring-offset-2 ring-offset-background shadow-2xl transition-all duration-300 animate-pulse"
          style={{
            top: `${Math.max(0, targetRect.top - 4)}px`,
            left: `${Math.max(0, targetRect.left - 4)}px`,
            width: `${targetRect.width + 8}px`,
            height: `${targetRect.height + 8}px`,
          }}
        />
      )}

      {/* Guided Tour Interactive Card */}
      <div style={cardPositionStyle} role="dialog" aria-modal="true" aria-label={t('tourGuide')}>
        <Card className="border-border/80 bg-card text-foreground shadow-2xl overflow-hidden rounded-xl animate-in fade-in zoom-in-95 duration-200 border-2">
          {/* Top Progress Line */}
          <Progress value={progressPercent} className="h-1 rounded-none bg-muted" />

          <CardHeader className="p-4 pb-2 space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-semibold tracking-wide border-primary/30 text-primary gap-1">
                <Compass className="w-3 h-3" />
                <span>
                  {t('step')} {currentStep + 1} {t('of')} {steps.length}
                </span>
              </Badge>

              <button
                type="button"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
                aria-label={t('close')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <CardTitle className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span>{t(currentStepData.titleKey)}</span>
            </CardTitle>

            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              {t(currentStepData.descKey)}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-4 py-1">
            {/* Step navigation dots */}
            <div className="flex items-center gap-1.5 pt-1">
              {steps.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    idx === currentStep ? 'w-5 bg-primary' : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
                  }`}
                  aria-label={`${t('step')} ${idx + 1}`}
                />
              ))}
            </div>
          </CardContent>

          <CardFooter className="p-4 pt-3 flex items-center justify-between border-t border-border/50 bg-muted/20">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
            >
              {t('skip')}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="h-8 px-2.5 text-xs gap-1 border-border"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('prev')}</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleNext}
                className="h-8 px-3 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90 font-medium shadow-xs"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <span>{t('finish')}</span>
                    <Check className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>{t('next')}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
