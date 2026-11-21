'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  PatientCase,
  CaseTurn,
  VerifiedClaim,
  MissingInformation,
  SafetyAlert,
} from '@/types';
import { ProposedUpdate } from '@/lib/clinical-extractor';
import { CitationChip } from '@/components/shared/CitationChip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  User,
  Bot,
  Send,
  BookOpen,
  Sparkles,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ShieldAlert,
  FileCheck,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

interface CaseConversationTabProps {
  caseId: string;
  caseData: PatientCase;
  turns: CaseTurn[];
  onTurnsUpdate: (turns: CaseTurn[]) => void;
  onCaseUpdate: (updatedCase: PatientCase) => void;
  onOpenMobileSummary?: () => void;
}

export function CaseConversationTab({
  caseId,
  caseData,
  turns,
  onTurnsUpdate,
  onCaseUpdate,
  onOpenMobileSummary,
}: CaseConversationTabProps) {
  const locale = useLocale();
  const t = useTranslations('workspace');

  const [inputObservation, setInputObservation] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      return sessionStorage.getItem(`docmate_draft_case_${caseId}`) || '';
    } catch {
      return '';
    }
  });
  const [submitting, setSubmitting] = useState(false);
  const [requestingReview, setRequestingReview] = useState(false);
  const [inlineAnswers, setInlineAnswers] = useState<Record<string, string>>({});
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const draftStorageKey = `docmate_draft_case_${caseId}`;

  // Save draft on change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputObservation(val);
    try {
      if (val.trim()) {
        sessionStorage.setItem(draftStorageKey, val);
      } else {
        sessionStorage.removeItem(draftStorageKey);
      }
    } catch {
      // sessionStorage might be restricted
    }
  };

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns.length, submitting, requestingReview]);

  // Send natural language observation or request evidence review
  const handleSend = async (action: 'observation' | 'evidence_review' = 'observation') => {
    const textToSend = inputObservation.trim();
    if (!textToSend && action === 'observation') return;
    if (submitting || requestingReview) return;

    if (action === 'evidence_review') {
      setRequestingReview(true);
    } else {
      setSubmitting(true);
    }

    const draftId = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    try {
      const res = await fetch(`/api/cases/${caseId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          observation: textToSend || (locale === 'bn' ? 'প্রমাণ পর্যালোচনা অনুরোধ' : 'Request evidence review'),
          action,
          client_draft_id: draftId,
          locale,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to record observation');
      }

      const data = await res.json();
      if (data.turn) {
        const newTurns = [...turns, data.turn];
        if (data.assistantTurn) {
          newTurns.push(data.assistantTurn);
        }
        onTurnsUpdate(newTurns);

        // Clear draft
        setInputObservation('');
        try {
          sessionStorage.removeItem(draftStorageKey);
        } catch {
          // ignore
        }

        if (action === 'evidence_review') {
          toast.success(locale === 'bn' ? 'প্রমাণ পর্যালোচনা সম্পন্ন হয়েছে' : 'Evidence review completed');
        } else {
          toast.success(locale === 'bn' ? 'পর্যবেক্ষণ রেকর্ড করা হয়েছে' : 'Observation recorded');
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending observation';
      toast.error(msg);
    } finally {
      setSubmitting(false);
      setRequestingReview(false);
    }
  };

  // Keyboard shortcut: Enter sends, Shift+Enter new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend('observation');
    }
  };

  // Handle confirming or dismissing a proposed structured update
  const handleConfirmUpdate = async (
    turnId: string,
    updateId: string,
    action: 'confirm' | 'dismiss'
  ) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/confirm-update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turn_id: turnId, update_id: updateId, action }),
      });

      if (!res.ok) {
        throw new Error('Could not process update');
      }

      const data = await res.json();
      if (data.case) {
        onCaseUpdate(data.case);
      }

      // Refresh turns
      const turnsRes = await fetch(`/api/cases/${caseId}`);
      if (turnsRes.ok) {
        const turnsData = await turnsRes.json();
        if (turnsData.turns) {
          onTurnsUpdate(turnsData.turns);
        }
      }

      if (action === 'confirm') {
        toast.success(t('statusConfirmed'));
      } else {
        toast.info(t('statusDismissed'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update';
      toast.error(msg);
    }
  };

  // Submit inline answer to a follow-up question
  const handleAnswerSubmit = async (questionId: string, questionText: string) => {
    const answer = (inlineAnswers[questionId] || '').trim();
    if (!answer) return;

    setAnsweringQuestionId(questionId);
    try {
      const res = await fetch(`/api/cases/${caseId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'question_answer',
          question_id: questionId,
          question: questionText,
          answer,
          locale,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit answer');
      }

      const data = await res.json();
      if (data.turn) {
        onTurnsUpdate([...turns, data.turn]);
        setInlineAnswers((prev) => {
          const next = { ...prev };
          delete next[questionId];
          return next;
        });
        toast.success('Clinical observation recorded');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record answer';
      toast.error(msg);
    } finally {
      setAnsweringQuestionId(null);
    }
  };

  return (
    <div className="flex flex-col h-[700px] max-h-[82vh] bg-background rounded-xl border border-border/80 shadow-xs overflow-hidden">
      {/* Conversation Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/70 bg-card/60 backdrop-blur-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <span>{t('tabConversation')} • {caseData.patient_code}</span>
              <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                {locale === 'bn' ? 'সংরক্ষিত লাইব্রেরি' : 'Closed Library Only'}
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground">
              {locale === 'bn'
                ? 'পর্যবেক্ষণ লিখুন, উদ্ধৃতি যাচাই করুন এবং রোগীর তথ্য আপডেট করুন'
                : 'Write clinical notes, inspect citations, and confirm structured patient updates'}
            </p>
          </div>
        </div>

        {/* Mobile Patient Summary Sheet Button */}
        {onOpenMobileSummary && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMobileSummary}
            className="lg:hidden gap-1.5 text-xs font-semibold h-8 border-primary/30 text-primary hover:bg-primary/10"
            aria-label={t('viewPatientSummary')}
          >
            <User className="w-3.5 h-3.5" />
            <span>{t('viewPatientSummary')}</span>
          </Button>
        )}
      </div>

      {/* Message Stream */}
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Case conversation message stream"
        className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
      >
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <Sparkles className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-foreground">
              {locale === 'bn' ? 'ক্লিনিকাল কেস পরামর্শ প্রস্তুত' : 'Case Consultation Ready'}
            </h4>
            <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
              {t('noConversationYet')}
            </p>
            <div className="pt-2 flex flex-wrap gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleSend('evidence_review')}
                disabled={requestingReview}
                className="gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{t('requestEvidenceReview')}</span>
              </Button>
            </div>
          </div>
        ) : (
          turns.map((turn, turnIdx) => {
            const content = (turn.content || {}) as Record<string, unknown>;
            const turnType = content.type as string;
            const isDoctor = turn.role === 'doctor';
            const rawDate = turn.created_at || (turn as unknown as Record<string, unknown>).createdAt || new Date();
            const timestamp = new Date(rawDate as string | number | Date).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });

            // 1. Case Event / System Audit Pill
            if (turnType === 'case_event' || turnType === 'status_change') {
              return (
                <div key={turn.id || turnIdx} className="flex justify-center my-2">
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/80 border border-border/60 text-[11px] text-muted-foreground font-medium shadow-2xs">
                    <FileCheck className="w-3.5 h-3.5 text-primary" />
                    <span>{(content.description as string) || (content.note as string) || t('confirmedObservation')}</span>
                    <span className="text-[10px] opacity-70">• {timestamp}</span>
                  </div>
                </div>
              );
            }

            // 2. Doctor Message
            if (isDoctor) {
              const obsText =
                (content.text as string) ||
                (content.observation as string) ||
                (content.note as string) ||
                (content.answer ? `Q: ${content.question}\nA: ${content.answer}` : '');

              return (
                <div key={turn.id || turnIdx} className="flex flex-col items-end space-y-1">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                    <span className="font-semibold text-foreground">
                      {locale === 'bn' ? 'চিকিৎসক (Attending)' : 'Attending Physician'}
                    </span>
                    <Clock className="w-3 h-3" />
                    <span>{timestamp}</span>
                  </div>
                  <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-primary text-primary-foreground p-3.5 shadow-xs text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                    {obsText}
                  </div>
                </div>
              );
            }

            // 3. Assistant Reply
            const assistantText = (content.text as string) || '';
            const proposedUpdates = (content.proposed_updates as ProposedUpdate[]) || [];
            const followUps = (content.follow_ups as MissingInformation[]) || [];
            const citations = (content.citations as VerifiedClaim[]) || [];
            const safetyAlerts = (content.safety_alerts as SafetyAlert[]) || [];

            return (
              <div key={turn.id || turnIdx} className="flex flex-col items-start space-y-3">
                {/* Header */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
                  <div className="w-5 h-5 rounded bg-primary/10 text-primary flex items-center justify-center">
                    <Bot className="w-3 h-3" />
                  </div>
                  <span className="font-bold text-foreground">DocMate AI</span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/20 text-primary font-semibold">
                    {t('draftSuggestion')}
                  </Badge>
                  <Clock className="w-3 h-3 ml-1" />
                  <span>{timestamp}</span>
                </div>

                {/* Assistant Main Text */}
                {assistantText && (
                  <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl rounded-tl-xs bg-card border border-border/80 p-4 shadow-xs text-xs sm:text-sm leading-relaxed text-foreground">
                    <p className="whitespace-pre-wrap">{assistantText}</p>

                    {/* Verbatim Citations Inline */}
                    {citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                          {locale === 'bn' ? 'লাইব্রেরি উদ্ধৃতি প্রমাণ:' : 'Verified Library Citations:'}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {citations.map((claim, cIdx) => (
                            <CitationChip key={claim.chunk_id || cIdx} index={cIdx + 1} claim={claim} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Safety Alerts Callout */}
                {safetyAlerts.length > 0 && (
                  <div className="w-full max-w-[90%] sm:max-w-[85%] space-y-2">
                    {safetyAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                          alert.severity === 'critical'
                            ? 'bg-destructive/10 border-destructive/30 text-destructive'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300'
                        }`}
                      >
                        <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="font-bold block">{alert.title}</span>
                          <span className="text-[11px] leading-relaxed block">{alert.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Proposed Structured Patient Updates Card */}
                {proposedUpdates.length > 0 && (
                  <Card className="w-full max-w-[90%] sm:max-w-[85%] border-primary/30 bg-primary/5 p-4 space-y-3 shadow-2xs">
                    <div className="flex items-center gap-2 text-primary font-bold text-xs">
                      <Sparkles className="w-4 h-4" />
                      <span>{t('proposedUpdateTitle')}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t('proposedUpdateDesc')}
                    </p>

                    <div className="space-y-2.5">
                      {proposedUpdates.map((update) => (
                        <div
                          key={update.id}
                          className="p-3 rounded-lg bg-card border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">
                                {locale === 'bn' ? update.label_bn : update.label_en}:
                              </span>
                              <span className="font-semibold text-primary">{update.display_value}</span>
                              <Badge
                                variant={
                                  update.status === 'confirmed'
                                    ? 'default'
                                    : update.status === 'dismissed'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className={`text-[10px] py-0 px-1.5 font-semibold ${
                                  update.status === 'confirmed'
                                    ? 'bg-emerald-600 text-white'
                                    : update.status === 'dismissed'
                                    ? 'bg-muted text-muted-foreground'
                                    : 'border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/10'
                                }`}
                              >
                                {update.status === 'confirmed'
                                  ? t('statusConfirmed')
                                  : update.status === 'dismissed'
                                  ? t('statusDismissed')
                                  : t('statusPending')}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-muted-foreground italic">
                              <span className="font-medium not-italic">{t('originalWording')}:</span> &ldquo;{update.original_wording}&rdquo;
                            </div>
                          </div>

                          {update.status === 'pending' && (
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                size="sm"
                                onClick={() => void handleConfirmUpdate(turn.id, update.id, 'confirm')}
                                className="h-7 px-2.5 text-xs font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{t('confirmUpdate')}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleConfirmUpdate(turn.id, update.id, 'dismiss')}
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{t('dismissUpdate')}</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Inline Missing Information Follow-Ups */}
                {followUps.length > 0 && (
                  <div className="w-full max-w-[90%] sm:max-w-[85%] space-y-2.5">
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                      {t('followUpTitle')}
                    </span>
                    {followUps.map((question) => (
                      <Card key={question.id} className="p-3.5 border-amber-500/30 bg-amber-500/5 space-y-2 text-xs">
                        <div className="flex items-start gap-2">
                          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div className="space-y-1 flex-1">
                            <span className="font-bold text-foreground block">{question.text}</span>
                            {question.why_it_helps && (
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <span className="font-semibold">{t('whyItHelps')}</span> {question.why_it_helps}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <input
                            type="text"
                            placeholder={locale === 'bn' ? 'ক্লিনিকাল ফলাফল লিখুন...' : 'Enter clinical finding or result...'}
                            value={inlineAnswers[question.id] || ''}
                            onChange={(e) =>
                              setInlineAnswers((prev) => ({
                                ...prev,
                                [question.id]: e.target.value,
                              }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void handleAnswerSubmit(question.id, question.text);
                              }
                            }}
                            className="flex-1 h-8 px-2.5 rounded-md border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <Button
                            size="sm"
                            onClick={() => void handleAnswerSubmit(question.id, question.text)}
                            disabled={answeringQuestionId === question.id || !inlineAnswers[question.id]?.trim()}
                            className="h-8 px-3 text-xs font-semibold gap-1"
                          >
                            <span>{t('submitInlineAnswer')}</span>
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Action Controls */}
      <div className="p-3 sm:p-4 border-t border-border/70 bg-card/70 backdrop-blur-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleSend('evidence_review')}
              disabled={submitting || requestingReview}
              className="h-7 px-2.5 text-xs font-medium gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{requestingReview ? t('requestingReview') : t('requestEvidenceReview')}</span>
            </Button>
          </div>

          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {locale === 'bn' ? 'Enter চাপলে পাঠানো হবে • Shift+Enter নতুন লাইন' : 'Press Enter to send • Shift+Enter for new line'}
          </span>
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={inputObservation}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t('inputPlaceholder')}
            disabled={submitting || requestingReview}
            rows={2}
            className="flex-1 min-h-[56px] max-h-32 text-xs sm:text-sm resize-none rounded-lg p-2.5 border-border/80 focus-visible:ring-1 focus-visible:ring-primary"
            aria-label={t('inputPlaceholder')}
          />
          <Button
            size="sm"
            onClick={() => void handleSend('observation')}
            disabled={submitting || requestingReview || !inputObservation.trim()}
            className="h-14 px-4 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5 shadow-xs shrink-0"
            aria-label={t('send')}
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{submitting ? t('submitting') : t('send')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
