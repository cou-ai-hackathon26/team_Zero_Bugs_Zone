'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  ChevronDown,
  Stethoscope,
  Copy,
  Check,
  Activity,
  Pill,
  AlertTriangle,
  Loader2,
  Mic,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useVoice } from '@/context/VoiceContext';

function generateClientDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface CaseConversationTabProps {
  caseId: string;
  caseData: PatientCase;
  turns: CaseTurn[];
  onTurnsUpdate: (turns: CaseTurn[]) => void;
  onCaseUpdate: (updatedCase: PatientCase) => void;
}

export function CaseConversationTab({
  caseId,
  turns,
  onTurnsUpdate,
  onCaseUpdate,
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
  const { openVoicePanel } = useVoice();
  const [inlineAnswers, setInlineAnswers] = useState<Record<string, string>>({});
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [expandedUpdates, setExpandedUpdates] = useState<Record<string, boolean>>({});
  const [copiedTurnId, setCopiedTurnId] = useState<string | null>(null);

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
  const handleSend = useCallback(async (action: 'observation' | 'evidence_review' = 'observation', customText?: string) => {
    const textToSend = (customText !== undefined ? customText : inputObservation).trim();
    if (!textToSend && action === 'observation') return;
    if (submitting || requestingReview) return;

    if (action === 'evidence_review') {
      setRequestingReview(true);
    } else {
      setSubmitting(true);
    }

    const draftId = generateClientDraftId();

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
  }, [caseId, draftStorageKey, inputObservation, locale, onTurnsUpdate, requestingReview, submitting, turns]);

  // Keyboard shortcut: Enter sends, Shift+Enter new line
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend('observation');
    }
  };

  // Copy clinical note to clipboard
  const handleCopyText = (turnId: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedTurnId(turnId);
      toast.success(t('copiedToClipboard'));
      setTimeout(() => setCopiedTurnId(null), 2000);
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

  // Submit answer to a follow-up question (supports typed text or 1-click chip)
  const handleAnswerSubmit = async (questionId: string, questionText: string, customAnswer?: string) => {
    const answer = (customAnswer !== undefined ? customAnswer : (inlineAnswers[questionId] || '')).trim();
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
        toast.success(locale === 'bn' ? 'ক্লিনিকাল পর্যবেক্ষণ সংরক্ষিত' : 'Observation recorded');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record answer';
      toast.error(msg);
    } finally {
      setAnsweringQuestionId(null);
    }
  };

  const toggleUpdateExpanded = (updateId: string) => {
    setExpandedUpdates((prev) => ({
      ...prev,
      [updateId]: !prev[updateId],
    }));
  };

  // Quick Action Prompt Chips for doctors
  const promptChips = [
    {
      icon: Stethoscope,
      label: t('promptDifferentials'),
      query:
        locale === 'bn'
          ? 'বর্তমান উপসর্গের ভিত্তিতে সবচেয়ে সম্ভাব্য ডিফারেনশিয়াল রোগসমূহ কী কী?'
          : 'What are the top differential diagnoses based on these clinical findings?',
    },
    {
      icon: Activity,
      label: t('promptLabs'),
      query:
        locale === 'bn'
          ? 'এই রোগীর জন্য কোন কোন ল্যাব টেস্ট ও রেডিওলজি পরীক্ষা নির্দেশিত?'
          : 'What laboratory or diagnostic imaging tests should be prioritized?',
    },
    {
      icon: Pill,
      label: t('promptTreatment'),
      query:
        locale === 'bn'
          ? 'জাতীয় গাইডলাইন ও ডিজিডিএ ফর্মুলারি অনুসারে প্রথম সারির চিকিৎসা নির্দেশনা কী?'
          : 'What is the recommended first-line treatment regimen according to guidelines?',
    },
    {
      icon: AlertTriangle,
      label: t('promptRedFlags'),
      query:
        locale === 'bn'
          ? 'এই রোগীর ক্ষেত্রে কোন কোন জরুরি রেড ফ্ল্যাগ সতর্কতা তাৎক্ষণিকভাবে যাচাই করা প্রয়োজন?'
          : 'What critical red-flag emergency signs must be monitored closely?',
    },
  ];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background rounded-lg border border-border/80 shadow-2xs overflow-hidden">
      {/* Message Stream */}
      <div
        ref={scrollRef}
        tabIndex={0}
        aria-label="Case conversation stream"
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-3.5 focus:outline-none"
      >
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">
                {locale === 'bn' ? 'ক্লিনিকাল পরামর্শ প্রস্তুত' : 'Clinical Consultation Ready'}
              </h4>
              <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                {locale === 'bn'
                  ? 'রোগীর শারীরিক লক্ষণ, ভাইটালস বা পরীক্ষা লিখুন। অভ্যন্তরীণ মেডিকেল লাইব্রেরি থেকে যাচাইকৃত প্রমাণসহ সহায়তা পাবেন।'
                  : 'Enter patient symptoms, physical exam, or clinical questions. The system retrieves verified proofs from closed internal medical guidelines.'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {turns.map((turn, turnIdx) => {
              const content = (turn.content || {}) as Record<string, unknown>;
              const turnType = content.type as string;
              const isDoctor = turn.role === 'doctor';
              const rawDate = turn.created_at || (turn as unknown as Record<string, unknown>).createdAt || new Date();
              const timestamp = new Date(rawDate as string | number | Date).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              // 1. Audit / Event Log Pill
              if (turnType === 'case_event' || turnType === 'status_change') {
                return (
                  <div key={turn.id || turnIdx} className="flex justify-center my-1.5">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/70 border border-border/60 text-[11px] text-muted-foreground font-medium">
                      <FileCheck className="w-3.5 h-3.5 text-primary" />
                      <span>{(content.description as string) || (content.note as string) || t('confirmedObservation')}</span>
                      <span className="text-[10px] opacity-70">• {timestamp}</span>
                    </div>
                  </div>
                );
              }

              // 2. Doctor Message (Right)
              if (isDoctor) {
                const obsText =
                  (content.text as string) ||
                  (content.observation as string) ||
                  (content.note as string) ||
                  (content.answer ? `Q: ${content.question}\nA: ${content.answer}` : '');

                return (
                  <div key={turn.id || turnIdx} className="flex flex-col items-end space-y-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium pr-1">
                      <span className="font-semibold text-foreground">
                        {locale === 'bn' ? 'চিকিৎসক (Physician)' : 'Physician'}
                      </span>
                      <Clock className="w-3 h-3" />
                      <span>{timestamp}</span>
                    </div>
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tr-xs bg-primary text-primary-foreground px-4 py-3 shadow-xs text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {obsText}
                    </div>
                  </div>
                );
              }

              // 3. Assistant Message (Left)
              const assistantText = (content.text as string) || '';
              const proposedUpdates = (content.proposed_updates as ProposedUpdate[]) || [];
              const followUps = (content.follow_ups as MissingInformation[]) || [];
              const citations = (content.citations as VerifiedClaim[]) || [];
              const safetyAlerts = (content.safety_alerts as SafetyAlert[]) || [];
              const turnIdentifier = turn.id || String(turnIdx);

              return (
                <div key={turnIdentifier} className="flex flex-col items-start space-y-2.5">
                  {/* Assistant Identity */}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium pl-1">
                    <div className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Bot className="w-2.5 h-2.5" />
                    </div>
                    <span className="font-bold text-foreground">DocMate AI</span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/20 text-primary font-semibold">
                      {t('draftSuggestion')}
                    </Badge>
                    <Clock className="w-3 h-3 ml-1" />
                    <span>{timestamp}</span>
                  </div>

                  {/* Main Speech Bubble with Copy Action */}
                  {assistantText && (
                    <div className="relative group max-w-[92%] sm:max-w-[85%] rounded-2xl rounded-tl-xs bg-card border border-border/80 px-4 py-3.5 shadow-xs text-xs sm:text-sm leading-relaxed text-foreground">
                      {/* Copy Action Button */}
                      <button
                        type="button"
                        onClick={() => handleCopyText(turnIdentifier, assistantText)}
                        aria-label={t('copyNote')}
                        title={t('copyNote')}
                        className="absolute right-2.5 top-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copiedTurnId === turnIdentifier ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <p className="whitespace-pre-wrap pr-6">{assistantText}</p>

                      {/* Inline Verbatim Citations - opens EvidenceSheet on click */}
                      {citations.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center flex-wrap gap-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1">
                            {locale === 'bn' ? 'যাচাইকৃত প্রমাণ উদ্ধৃতি:' : 'Verified Evidence:'}
                          </span>
                          {citations.map((claim, cIdx) => (
                            <CitationChip key={claim.chunk_id || cIdx} index={cIdx + 1} claim={claim} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Compact Safety Warning Banner */}
                  {safetyAlerts.length > 0 && (
                    <div className="w-full max-w-[92%] sm:max-w-[85%] space-y-1.5">
                      {safetyAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`px-3 py-2 rounded-lg border text-xs flex items-start gap-2 ${
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

                  {/* Proposed Patient Record Updates - Expandable Section */}
                  {proposedUpdates.length > 0 && (
                    <div className="w-full max-w-[92%] sm:max-w-[85%] space-y-2">
                      {proposedUpdates.map((update) => {
                        const isExpanded = expandedUpdates[update.id] ?? (update.status === 'pending');
                        return (
                          <Card
                            key={update.id}
                            className="border-primary/20 bg-primary/5 p-3 text-xs space-y-2 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="font-bold text-foreground truncate">
                                  {locale === 'bn' ? update.label_bn : update.label_en}:
                                </span>
                                <span className="font-semibold text-primary truncate">
                                  {update.display_value}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
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

                                <button
                                  type="button"
                                  onClick={() => toggleUpdateExpanded(update.id)}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                                  aria-label="Toggle details"
                                >
                                  <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  />
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="pt-2 border-t border-border/60 space-y-2">
                                <div className="text-[11px] text-muted-foreground">
                                  <span className="font-semibold text-foreground mr-1">
                                    {t('originalWording')}:
                                  </span>
                                  &ldquo;{update.original_wording}&rdquo;
                                </div>

                                {update.status === 'pending' && (
                                  <div className="flex items-center gap-2 pt-1">
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
                            )}
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Follow-up Questions with 1-Click Quick Answer Chips */}
                  {followUps.length > 0 && (
                    <div className="w-full max-w-[92%] sm:max-w-[85%] space-y-2">
                      {followUps.map((question) => (
                        <Card
                          key={question.id}
                          className="p-3 border-amber-500/30 bg-amber-500/5 space-y-2 text-xs"
                        >
                          <div className="flex items-start gap-2">
                            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 flex-1">
                              <span className="font-bold text-foreground block">{question.text}</span>
                              {question.why_it_helps && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  <span className="font-semibold">{t('whyItHelps')}</span> {question.why_it_helps}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* 1-Tap Quick Answer Chips */}
                          {question.quick_answers && question.quick_answers.length > 0 && (
                            <div className="flex items-center flex-wrap gap-1.5 pt-1">
                              {question.quick_answers.map((quickChip) => (
                                <button
                                  key={quickChip}
                                  type="button"
                                  onClick={() => void handleAnswerSubmit(question.id, question.text, quickChip)}
                                  disabled={answeringQuestionId === question.id}
                                  className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-background border border-border/80 hover:bg-primary/10 hover:border-primary/40 text-foreground transition-all flex items-center gap-1 active:scale-95 shadow-2xs"
                                >
                                  <span>{quickChip}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Custom manual answer input */}
                          <div className="flex items-center gap-2 pt-1">
                            <input
                              type="text"
                              placeholder={locale === 'bn' ? 'বা কাস্টম ক্লিনিকাল ফলাফল লিখুন...' : 'Or enter custom findings...'}
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
            })}

            {/* Smart Thinking / Guideline Analyzing State */}
            {(submitting || requestingReview) && (
              <div className="flex flex-col items-start space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium pl-1">
                  <div className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center animate-pulse">
                    <Sparkles className="w-2.5 h-2.5" />
                  </div>
                  <span className="font-bold text-foreground">DocMate AI</span>
                  <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/30 text-primary animate-pulse">
                    {requestingReview ? t('requestingReview') : t('analyzing')}
                  </Badge>
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-muted/70 border border-border/80 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2.5 shadow-2xs">
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                  <span className="font-medium">{t('analyzingGuidelines')}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clean Floating Input Bar with Clinical Quick Prompts */}
      <div className="p-2 sm:p-2.5 shrink-0 border-t border-border/70 bg-card/70 backdrop-blur-xs space-y-2">
        {/* Horizontal Quick Prompts Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleSend('evidence_review')}
            disabled={submitting || requestingReview}
            className="h-6 px-2 text-[11px] font-semibold gap-1 border-primary/30 text-primary hover:bg-primary/10 shrink-0"
          >
            <BookOpen className="w-3 h-3" />
            <span>{requestingReview ? t('requestingReview') : t('requestEvidenceReview')}</span>
          </Button>

          {promptChips.map((chip, idx) => {
            const ChipIcon = chip.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => void handleSend('observation', chip.query)}
                disabled={submitting || requestingReview}
                className="h-6 px-2 rounded-md border border-border/70 bg-background/80 hover:bg-muted text-[11px] text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 shrink-0 transition-colors"
              >
                <ChipIcon className="w-3 h-3 text-primary" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={inputObservation}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={t('inputPlaceholder')}
            disabled={submitting || requestingReview}
            rows={1}
            className="flex-1 min-h-[38px] max-h-28 text-xs sm:text-sm resize-none rounded-lg p-2 border-border/80 focus-visible:ring-1 focus-visible:ring-primary bg-background"
            aria-label="Clinical observation input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openVoicePanel}
            aria-label={locale === 'bn' ? 'মুখে বলুন' : 'Speak observation'}
            className="h-[38px] w-[38px] p-0 border-border hover:border-primary/40 text-primary hover:bg-primary/10 shrink-0"
          >
            <Mic className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            onClick={() => void handleSend('observation')}
            disabled={submitting || requestingReview || !inputObservation.trim()}
            className="h-[38px] px-3.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1 shadow-xs shrink-0 text-xs"
            aria-label={t('send')}
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{submitting ? t('submitting') : t('send')}</span>
          </Button>
        </div>

        <div className="flex items-center justify-end text-[10px] text-muted-foreground px-1">
          <span className="hidden sm:inline">Enter ↵ {t('send')} • Shift+Enter ↵ {locale === 'bn' ? 'নতুন লাইন' : 'New line'}</span>
        </div>
      </div>
    </div>
  );
}
