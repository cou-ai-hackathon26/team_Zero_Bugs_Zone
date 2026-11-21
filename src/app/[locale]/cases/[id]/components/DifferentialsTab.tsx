'use client';

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ConfidenceBadge } from '@/components/shared/ConfidenceBadge';
import { CitationChip } from '@/components/shared/CitationChip';
import { AnalysisOutput, DifferentialDiagnosis } from '@/types';
import {
  AlertTriangle,
  CheckCircle2,
  Stethoscope,
  ArrowRight,
  ShieldAlert,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface DifferentialsTabProps {
  analysis: AnalysisOutput | null;
  analyzing: boolean;
  onRunAnalysis: () => void;
  onSelectDiagnosis: (condition: string) => void;
  onGoToMissingInfo: () => void;
}

export function DifferentialsTab({
  analysis,
  analyzing,
  onRunAnalysis,
  onSelectDiagnosis,
  onGoToMissingInfo,
}: DifferentialsTabProps) {
  const t = useTranslations('workspace');

  if (analyzing) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            {t('analyzing')}
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Querying internal medical library, verifying verbatim citations, and evaluating clinical differentials...
          </p>
        </div>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            No Clinical Analysis Performed Yet
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Execute the closed-library clinical reasoning engine to retrieve guideline passages, verify evidence, and propose ranked differential diagnoses.
          </p>
        </div>
        <Button onClick={onRunAnalysis} className="gap-2">
          <Stethoscope className="w-4 h-4" />
          {t('runAnalysis')}
        </Button>
      </Card>
    );
  }

  const getLikelihoodBadge = (label: 'high' | 'moderate' | 'low') => {
    switch (label) {
      case 'high':
        return (
          <Badge className="bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold">
            High Likelihood
          </Badge>
        );
      case 'moderate':
        return (
          <Badge variant="secondary" className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 text-xs font-semibold">
            Moderate Likelihood
          </Badge>
        );
      case 'low':
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground text-xs">
            Low Likelihood
          </Badge>
        );
    }
  };

  const defaultAccordionValue = analysis.differentials[0]
    ? [analysis.differentials[0].condition]
    : [];

  return (
    <div className="space-y-4">
      {/* Red Flag Emergency Banner */}
      {analysis.status === 'red_flag' && (
        <Alert variant="destructive" className="border-2 border-destructive shadow-sm">
          <ShieldAlert className="w-5 h-5 text-destructive animate-pulse" />
          <AlertTitle className="text-sm font-bold tracking-tight">
            {t('redFlagBanner')}
          </AlertTitle>
          <AlertDescription className="text-xs mt-1.5 space-y-2">
            <p className="font-medium">
              Deterministic red-flag safety criteria triggered from patient vitals or acute presentation:
            </p>
            {analysis.red_flags && analysis.red_flags.length > 0 && (
              <ul className="list-disc list-inside space-y-1 font-semibold text-destructive-foreground">
                {analysis.red_flags.map((flag, idx) => (
                  <li key={idx}>{flag}</li>
                ))}
              </ul>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Insufficient Evidence Alert */}
      {analysis.status === 'insufficient_evidence' && (
        <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <AlertTitle className="text-sm font-semibold">
              {t('insufficientTitle')}
            </AlertTitle>
            <AlertDescription className="text-xs mt-1 text-amber-800 dark:text-amber-300">
              {t('insufficientDesc')}
            </AlertDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onGoToMissingInfo}
            className="shrink-0 gap-1.5 border-amber-500/40 hover:bg-amber-500/20 text-xs font-semibold"
          >
            Review Missing Information
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Alert>
      )}

      {/* Confidence Header & Summary */}
      <Card className="p-4 border-border/70 bg-card shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t('confidence')}:
              </span>
              <ConfidenceBadge
                label={analysis.confidence.label}
                score={analysis.confidence.score}
              />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {analysis.confidence.reasoning}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onRunAnalysis}
            className="shrink-0 text-xs gap-1.5 self-start sm:self-auto"
          >
            <Stethoscope className="w-3.5 h-3.5 text-primary" />
            {t('reAnalyze')}
          </Button>
        </div>
      </Card>

      {/* Differentials Accordion */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1">
          Ranked Differential Diagnoses ({analysis.differentials.length})
        </h3>

        <Accordion
          defaultValue={defaultAccordionValue}
          className="space-y-3"
        >
          {analysis.differentials.map((diff: DifferentialDiagnosis, idx: number) => {
            const verifiedCitationCount =
              (diff.supporting_claims?.filter((c) => c.verified !== false).length || 0) +
              (diff.opposing_claims?.filter((c) => c.verified !== false).length || 0);

            return (
              <AccordionItem
                key={diff.condition}
                value={diff.condition}
                className="border border-border/80 rounded-lg overflow-hidden bg-card shadow-2xs data-open:border-primary/50 transition-colors"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40">
                  <div className="flex flex-1 items-center justify-between gap-3 pr-3 text-left">
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-semibold text-sm text-foreground">
                          {diff.condition_bn || diff.condition}
                        </span>
                        {diff.condition_bn && (
                          <span className="text-xs text-muted-foreground ml-2 font-normal">
                            ({diff.condition})
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[11px] gap-1 px-2 py-0.5">
                        <span className="font-semibold text-primary">{verifiedCitationCount}</span> citations
                      </Badge>
                      {getLikelihoodBadge(diff.likelihood_label)}
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="px-4 pb-4 pt-1 space-y-4 border-t border-border/40">
                  {/* Clinical Rationale */}
                  <div className="space-y-1">
                    <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Clinical Rationale
                    </h5>
                    <p className="text-xs text-foreground leading-relaxed bg-muted/40 p-3 rounded-md border border-border/50">
                      {diff.clinical_rationale}
                    </p>
                  </div>

                  {/* Supporting Claims */}
                  {diff.supporting_claims && diff.supporting_claims.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Supporting Evidence ({diff.supporting_claims.length})
                      </h5>
                      <div className="space-y-2">
                        {diff.supporting_claims.map((claim, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-1.5"
                          >
                            <p className="text-foreground font-medium leading-snug">
                              {claim.text}
                            </p>
                            <div className="flex items-start justify-between gap-2 pt-1 border-t border-emerald-500/10">
                              <p className="italic text-[11px] text-muted-foreground line-clamp-2">
                                &ldquo;{claim.quote}&rdquo;
                              </p>
                              <CitationChip
                                index={cIdx + 1}
                                claim={claim}
                                className="shrink-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opposing Claims */}
                  {diff.opposing_claims && diff.opposing_claims.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Opposing or Differentiating Factors ({diff.opposing_claims.length})
                      </h5>
                      <div className="space-y-2">
                        {diff.opposing_claims.map((claim, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2.5 rounded-md bg-rose-500/5 border border-rose-500/20 text-xs space-y-1.5"
                          >
                            <p className="text-foreground font-medium leading-snug">
                              {claim.text}
                            </p>
                            <div className="flex items-start justify-between gap-2 pt-1 border-t border-rose-500/10">
                              <p className="italic text-[11px] text-muted-foreground line-clamp-2">
                                &ldquo;{claim.quote}&rdquo;
                              </p>
                              <CitationChip
                                index={cIdx + 1}
                                claim={claim}
                                className="shrink-0"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confirm Working Diagnosis CTA */}
                  <div className="pt-2 flex justify-end">
                    <Button
                      size="sm"
                      onClick={() => onSelectDiagnosis(diff.condition)}
                      className="gap-2 font-semibold text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Confirm as Working Diagnosis
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
}
