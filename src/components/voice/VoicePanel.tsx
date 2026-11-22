'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useVoice } from '@/context/VoiceContext';
import { DocMateAvatar } from './DocMateAvatar';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import {
  Mic,
  Square,
  X,
  Settings,
  Send,
  BookOpen,
  ArrowRight,
  Sparkles,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ConversationLanguage } from '@/lib/voice/conversation';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';

export function VoicePanel() {
  const locale = useLocale();
  const t = useTranslations('voice');
  const isMobile = useIsMobile();
  const { openEvidence } = useEvidenceSheet();
  const {
    isOpen,
    closeVoicePanel,
    state,
    amplitude,
    transcript,
    interimTranscript,
    messages,
    config,
    conversationLanguage,
    setConversationLanguage,
    microphoneLocale,
    privateMode,
    avatarVisible,
    errorText,
    startPushToTalk,
    stopPushToTalk,
    cancelPushToTalk,
    stopSpeech,
    submitTranscript,
    setPrivateMode,
    setAvatarVisible,
    setSpeechSpeed,
    clearMessages,
  } = useVoice();

  const [isPressing, setIsPressing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editedInput, setEditedInput] = useState('');
  const [tourStep, setTourStep] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('voice_tour_completed') ? null : 1;
  });
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleNextTour = () => {
    if (tourStep === 3) {
      localStorage.setItem('voice_tour_completed', 'true');
      setTourStep(null);
    } else if (tourStep !== null) {
      setTourStep(tourStep + 1);
    }
  };

  const handleSkipTour = () => {
    localStorage.setItem('voice_tour_completed', 'true');
    setTourStep(null);
  };

  // Auto scroll chat to bottom when messages change
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, interimTranscript, state]);

  // Synchronize edited input with transcript
  useEffect(() => {
    if (transcript) {
      queueMicrotask(() => setEditedInput(transcript));
    }
  }, [transcript]);

  // Push-to-talk touch / mouse handlers
  const handlePress = () => {
    if (state === 'speaking') {
      stopSpeech();
      return;
    }
    setIsPressing(true);
    void startPushToTalk();
  };

  const handleRelease = () => {
    if (isPressing) {
      setIsPressing(false);
      void stopPushToTalk();
    }
  };

  // State label translation
  const getStateLabel = () => {
    if (errorText) return errorText;
    switch (state) {
      case 'listening':
        return locale === 'bn' ? 'শুনছি...' : 'Listening...';
      case 'transcribing':
        return locale === 'bn' ? 'বুঝছি...' : 'Transcribing...';
      case 'thinking':
        return locale === 'bn' ? 'ভাবছি...' : 'Thinking...';
      case 'speaking':
        return locale === 'bn' ? 'বলছি... (থামাতে ট্যাপ করুন)' : 'Speaking... (Tap to stop)';
      case 'alert':
        return locale === 'bn' ? 'সতর্কতা: স্ক্রিনে দেখুন' : 'Alert: Check screen';
      case 'confused':
        return locale === 'bn' ? 'আবার বলুন' : 'Please say again';
      case 'idle':
      default:
        return locale === 'bn' ? 'মাইক চেপে ধরে বলুন' : 'Hold mic and speak';
    }
  };

  const panelContent = (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-background text-foreground">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border/60 bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>{config.persona_name}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                AI Assistant
              </Badge>
            </h3>
            <p className="text-[11px] text-muted-foreground">{t('generatedVoice')}</p>
            <p className="text-[11px] text-muted-foreground" role="status">{getStateLabel()}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setShowSettings(!showSettings)}
            aria-label={locale === 'bn' ? 'সেটিংস' : 'Settings'}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={closeVoicePanel}
            aria-label={locale === 'bn' ? 'বন্ধ করুন' : 'Close'}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Settings Overlay Drawer Section */}
      {showSettings && (
        <div className="shrink-0 p-3 bg-muted/40 border-b border-border text-xs space-y-2.5 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold" htmlFor="voice-private-mode">{t('privateMode')}</label>
            <input
              type="checkbox"
              id="voice-private-mode"
              checked={privateMode}
              onChange={(e) => setPrivateMode(e.target.checked)}
              className="accent-primary w-4 h-4 rounded cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{locale === 'bn' ? 'ক্যারেক্টার দেখান' : 'Show Cartoon Avatar'}</span>
            <input
              type="checkbox"
              checked={avatarVisible}
              onChange={(e) => setAvatarVisible(e.target.checked)}
              className="accent-primary w-4 h-4 rounded cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{locale === 'bn' ? 'কথার গতি' : 'Speech Speed'}</span>
            <div className="flex items-center gap-1">
              {[0.8, 1.0, 1.2].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeechSpeed(spd)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10px] font-mono border',
                    config.default_speed === spd
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border'
                  )}
                >
                  {spd}x
                </button>
              ))}
            </div>
          </div>
          <div className="pt-1 flex justify-end">
            <button
              onClick={clearMessages}
              className="text-[10px] text-destructive hover:underline"
            >
              {locale === 'bn' ? 'কথোপকথন মুছুন' : 'Clear Chat'}
            </button>
          </div>
        </div>
      )}

      {/* 3-Step Voice Onboarding Tour */}
      {tourStep !== null && (
        <div className="shrink-0 m-3 p-3.5 rounded-lg border border-primary/30 bg-primary/5 text-xs space-y-2 animate-in fade-in-50">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {locale === 'bn' ? `গাইড: ধাপ ${tourStep}/৩` : `Guide: Step ${tourStep}/3`}
            </span>
            <button
              onClick={handleSkipTour}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              {locale === 'bn' ? 'এড়িয়ে যান' : 'Skip'}
            </button>
          </div>

          <div>
            <h4 className="font-bold text-foreground">
              {tourStep === 1 && (locale === 'bn' ? '১. মাইক চেপে ধরে বলুন' : '1. Hold mic to speak')}
              {tourStep === 2 && (locale === 'bn' ? '২. আমি যা শুনলাম তা দেখে নিশ্চিত করুন' : '2. Confirm what was heard')}
              {tourStep === 3 && (locale === 'bn' ? '৩. বিস্তারিত ও প্রমাণ স্ক্রিনে' : '3. Details and proof on screen')}
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
              {tourStep === 1 &&
                (locale === 'bn'
                  ? 'মাইক বাটন চেপে ধরে কথা বলুন এবং কথা শেষ হলে ছেড়ে দিন। কিবোর্ডে Space চেপেও বলতে পারেন।'
                  : 'Hold the mic button while speaking and release when done. You can also hold Space on desktop.')}
              {tourStep === 2 &&
                (locale === 'bn'
                  ? 'আপনার কথা শুনে যা লেখা হয়েছে তা স্ক্রিনে দেখে নিন, প্রয়োজনে এডিট করুন বা হ্যাঁ বলুন।'
                  : 'Review the transcript on screen, verify or edit it, or say "yes".')}
              {tourStep === 3 &&
                (locale === 'bn'
                  ? 'চিকিৎসা পরামর্শের পূর্ণ বিবরণ ও রেফারেন্স স্ক্রিনে প্রদর্শিত হয়। সহকারী সংক্ষেপে সারসংক্ষেপ বলবে।'
                  : 'Full clinical evidence and citations appear on screen. The assistant speaks a brief 2-3 sentence summary.')}
            </p>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground/70">
              {locale === 'bn' ? 'অডিও কোথাও সংরক্ষণ হয় না' : 'Audio is never stored'}
            </span>
            <Button
              size="sm"
              onClick={handleNextTour}
              className="h-7 text-xs px-2.5"
            >
              {tourStep === 3
                ? locale === 'bn'
                  ? 'শুরু করুন'
                  : 'Get Started'
                : locale === 'bn'
                  ? 'পরবর্তী'
                  : 'Next'}
            </Button>
          </div>
        </div>
      )}

      {/* Main Hero: Animated Doctor Character & Live State */}
      <div className="shrink-0 p-4 pb-2 flex flex-col items-center justify-center bg-radial from-primary/5 to-transparent">
        {avatarVisible && (
          <div className="relative cursor-pointer group" onClick={state === 'speaking' ? stopSpeech : undefined}>
            <DocMateAvatar
              state={state}
              amplitude={amplitude}
              size="lg"
              className="transition-transform group-hover:scale-102"
            />
            {state === 'speaking' && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground rounded-full shadow-md animate-pulse">
                {locale === 'bn' ? 'থামাতে ট্যাপ করুন' : 'Tap to stop'}
              </span>
            )}
          </div>
        )}

        {/* Live Audio Visualizer Bars */}
        <div className="flex items-center gap-1 h-6 mt-3">
          {[0.2, 0.5, 0.9, 0.6, 0.3, 0.8, 0.4].map((scale, i) => (
            <span
              key={i}
              className={cn(
                'w-1 rounded-full bg-primary transition-all duration-75',
                state === 'listening' ? 'opacity-90' : state === 'speaking' ? 'bg-blue-500 opacity-80' : 'opacity-20'
              )}
              style={{
                height: `${Math.max(4, (state === 'listening' || state === 'speaking' ? amplitude * 24 : 4) * scale)}px`,
              }}
            />
          ))}
        </div>

        {privateMode && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/80 mt-1">
            <Lock className="w-3 h-3 text-emerald-600" />
            {t('dictationReviewOnly')}
          </span>
        )}
      </div>

      {/* Spoken Conversation Bubble Stream */}
      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5 border-t border-border/50 overscroll-contain"
      >
        {messages.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground space-y-2">
            <Sparkles className="w-6 h-6 mx-auto text-primary/40 animate-pulse" />
            <p className="font-medium text-foreground">
              {locale === 'bn' ? 'ডকমেট এআই প্রস্তুত' : 'DocMate AI is Ready'}
            </p>
            <p className="text-[11px] max-w-xs mx-auto">
              {locale === 'bn'
                ? 'মাইক চেপে ধরে যেকোনো ক্লিনিকাল বা গাইডলাইন প্রশ্ন জিজ্ঞেস করুন।'
                : 'Hold the microphone to ask any clinical guideline question.'}
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn('flex flex-col', m.sender === 'doctor' ? 'items-end' : 'items-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-xs space-y-1.5',
                  m.sender === 'doctor'
                    ? 'bg-primary text-primary-foreground rounded-br-xs'
                    : 'bg-muted/80 text-foreground border border-border/70 rounded-bl-xs'
                )}
              >
                <p lang={m.locale} className="leading-relaxed whitespace-pre-wrap">{m.text}</p>

                {/* Verbatim Citations Chip */}
                {m.citations && m.citations.length > 0 && (
                  <div className="pt-1.5 border-t border-border/40 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="font-semibold text-primary flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {locale === 'bn' ? 'প্রমাণ উদ্ধৃতি:' : 'Citations:'}
                    </span>
                    {m.citations.map((c, i) => (
                      <button
                        key={c.chunk_id || i}
                        onClick={() => openEvidence(c)}
                        className="px-2 py-0.5 rounded bg-background/80 hover:bg-background border border-primary/30 text-primary font-medium hover:underline flex items-center gap-1 transition-colors"
                      >
                        <span>[{i + 1}] {c.source_title ? c.source_title.slice(0, 16) + '...' : 'Guideline'}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[9px] text-muted-foreground mt-0.5 px-1">
                {new Date(m.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))
        )}

        {/* Live Transcribing Preview Bubble */}
        {(interimTranscript || state === 'transcribing') && (
          <div className="flex flex-col items-end animate-pulse">
            <div className="max-w-[85%] rounded-2xl px-3.5 py-2 text-xs bg-primary/20 text-primary border border-primary/30 rounded-br-xs">
              <p className="italic">
                {interimTranscript || (locale === 'bn' ? 'শুনছি...' : 'Hearing...')}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Suggestion Chips */}
      <div className="shrink-0 px-3 py-1.5 border-t border-border/50 bg-muted/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {[
          { label: t('quickNewPatient'), query: t('conversationNewPatientQuery') },
          { label: t('conversationDengue'), query: t('conversationDengueQuery') },
          { label: t('readPrescription'), query: t('conversationPrescriptionQuery') },
          { label: t('conversationEvidence'), query: t('conversationEvidenceQuery') },
        ].map((chip) => (
          <button
            key={chip.query}
            onClick={() => submitTranscript(chip.query)}
            className="shrink-0 px-2.5 py-1 text-[11px] rounded-full border border-border bg-card hover:bg-primary/10 hover:border-primary/40 text-foreground transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Editable Transcript Input & Microphone Action Bar */}
      <div className="shrink-0 p-3 sm:p-4 border-t border-border/60 bg-card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <label className="flex flex-wrap items-center gap-2 text-xs font-medium">
            {t('conversationLanguage')}
            <select
              value={conversationLanguage}
              onChange={(event) => setConversationLanguage(event.currentTarget.value as ConversationLanguage)}
              disabled={isPressing || state === 'listening' || state === 'transcribing'}
              className="min-h-11 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="auto">{t('conversationAuto')}</option>
              <option value="bn" lang="bn">{t('conversationBangla')}</option>
              <option value="en" lang="en">{t('conversationEnglish')}</option>
            </select>
          </label>
          <span className="text-xs text-muted-foreground">
            {t(microphoneLocale === 'bn' ? 'conversationMicBangla' : 'conversationMicEnglish')}
          </span>
        </div>

        {/* Editable Heard Input */}
        <div className="flex items-center gap-2">
          <Input
            value={editedInput}
            onChange={(e) => setEditedInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                submitTranscript(editedInput);
                setEditedInput('');
              }
            }}
            placeholder={
              locale === 'bn'
                ? 'যা শুনলাম তা এখানে এডিট করুন বা টাইপ করুন...'
                : 'Edit transcript here or type...'
            }
            className="text-xs h-9 bg-muted/30 focus-visible:ring-1"
          />
          <Button
            size="sm"
            onClick={() => {
              submitTranscript(editedInput);
              setEditedInput('');
            }}
            disabled={!editedInput.trim()}
            className="h-9 px-3 gap-1 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{locale === 'bn' ? 'পাঠান' : 'Send'}</span>
          </Button>
        </div>

        {/* Central Large Push-To-Talk Button (>= 64px touch target) */}
        <div className="flex flex-col items-center justify-center">
          <button
            type="button"
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              handlePress();
            }}
            onPointerUp={handleRelease}
            onPointerCancel={() => {
              setIsPressing(false);
              cancelPushToTalk();
            }}
            onKeyDown={(event) => {
              if (event.key !== ' ' && event.key !== 'Enter') return;
              event.preventDefault();
              if (!event.repeat) handlePress();
            }}
            onKeyUp={(event) => {
              if (event.key !== ' ' && event.key !== 'Enter') return;
              event.preventDefault();
              handleRelease();
            }}
            onBlur={() => {
              if (!isPressing) return;
              setIsPressing(false);
              cancelPushToTalk();
            }}
            aria-label={state === 'speaking' ? t('tapToStop') : t('holdToSpeak')}
            className={cn(
              'w-16 h-16 sm:w-18 sm:h-18 rounded-full flex items-center justify-center transition-all duration-200 select-none touch-none shadow-lg',
              state === 'listening'
                ? 'bg-rose-600 text-white ring-4 ring-rose-400/50 scale-110 shadow-rose-500/40'
                : state === 'speaking'
                ? 'bg-blue-600 text-white ring-4 ring-blue-400/40'
                : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 shadow-primary/30'
            )}
          >
            {state === 'speaking' ? (
              <Square className="w-6 h-6 animate-pulse" />
            ) : state === 'listening' ? (
              <Mic className="w-7 h-7 animate-bounce" />
            ) : (
              <Mic className="w-7 h-7" />
            )}
          </button>
          <span className="text-[11px] font-semibold text-muted-foreground mt-2">
            {state === 'speaking'
              ? locale === 'bn'
                ? 'কথা থামান'
                : 'Stop Speech'
              : state === 'listening'
              ? locale === 'bn'
                ? 'ছেড়ে দিলে পাঠানো হবে'
                : 'Release to send'
              : locale === 'bn'
              ? 'চেপে ধরে বলুন (Push-To-Talk)'
              : 'Hold to speak (Push-To-Talk)'}
          </span>
        </div>
      </div>
    </div>
  );

  // Responsive Partitioning:
  // Mobile (< 768px): Bottom Drawer (using Vaul Drawer)
  // Desktop (>= 768px): Docked side panel
  return (
    <>
      {/* Mobile Vaul Drawer */}
      <div className="md:hidden">
        <Drawer open={isMobile && isOpen} onOpenChange={(open) => !open && closeVoicePanel()}>
          <DrawerContent className="h-[85vh] max-h-[90vh] p-0 flex flex-col focus:outline-hidden">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{config.persona_name}</DrawerTitle>
              <DrawerDescription>{t('title')}</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {panelContent}
            </div>
            <DrawerFooter className="sr-only" />
          </DrawerContent>
        </Drawer>
      </div>

      {/* Desktop Docked Panel */}
      <div
        className={cn(
          'hidden md:block fixed top-0 right-0 bottom-0 w-[400px] z-50 bg-background border-l border-border shadow-2xl transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        )}
      >
        {!isMobile && isOpen && panelContent}
      </div>
    </>
  );
}
