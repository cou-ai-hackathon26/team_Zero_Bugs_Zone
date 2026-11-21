'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FollowUpQuestionCard } from '@/components/shared/FollowUpQuestionCard';
import { MissingInformation } from '@/types';
import {
  RefreshCw,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface MissingInfoTabProps {
  missingInfo: MissingInformation[];
  onAnswerSubmit: (questionId: string, answer: string, questionText: string) => void;
  onReAnalyze: () => void;
  reAnalyzing: boolean;
}

export function MissingInfoTab({
  missingInfo,
  onAnswerSubmit,
  onReAnalyze,
  reAnalyzing,
}: MissingInfoTabProps) {
  const t = useTranslations('workspace');

  if (!missingInfo || missingInfo.length === 0) {
    return (
      <Card className="p-8 text-center border-dashed border-2 flex flex-col items-center justify-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Sufficient Information Collected
        </h3>
        <p className="text-xs text-muted-foreground max-w-md">
          The internal medical library has retrieved sufficient clinical parameters and objective evidence for the current case.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Principle of Abstention Explanation */}
      <Alert className="border-primary/30 bg-primary/5 text-foreground">
        <Info className="w-5 h-5 text-primary shrink-0" />
        <div className="space-y-1">
          <AlertTitle className="text-sm font-semibold">
            {t('followUpTitle')} ({missingInfo.length})
          </AlertTitle>
          <AlertDescription className="text-xs text-muted-foreground leading-relaxed">
            DocMate AI operates strictly under <em>Abstention by Design</em>. When evidence is insufficient or discriminating clinical signs are absent, the model prompts for specific physical exams, tests, or clarifications rather than guessing.
          </AlertDescription>
        </div>
      </Alert>

      {/* List of Questions */}
      <div className="space-y-3">
        {missingInfo.map((item) => (
          <FollowUpQuestionCard
            key={item.id}
            item={item}
            onAnswerSubmit={(qId, ans) => onAnswerSubmit(qId, ans, item.text)}
            disabled={reAnalyzing}
          />
        ))}
      </div>

      {/* Re-analyze CTA */}
      <Card className="p-4 bg-muted/30 border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="space-y-0.5 text-center sm:text-left">
          <p className="text-xs font-semibold text-foreground">
            Ready to integrate answers into differential ranking?
          </p>
          <p className="text-[11px] text-muted-foreground">
            Submitting recorded clinical findings triggers Round + 1 reasoning against internal library passages.
          </p>
        </div>

        <Button
          onClick={onReAnalyze}
          disabled={reAnalyzing}
          className="gap-2 shrink-0 font-semibold text-xs"
        >
          {reAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Re-evaluating...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              {t('submitAnswers')}
            </>
          )}
        </Button>
      </Card>
    </div>
  );
}
