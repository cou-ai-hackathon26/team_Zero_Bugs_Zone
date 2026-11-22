'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState, VoiceConfig, VoiceMessage, SttProvider, TtsProvider } from '@/lib/voice/types';
import { createSttProvider } from '@/lib/voice/stt-provider';
import { createTtsProvider } from '@/lib/voice/tts-provider';
import { routeVoiceIntent } from '@/lib/voice/intent-router';
import { makeSpeakable } from '@/lib/voice/speakable';
import { extractClinicalFacts } from '@/lib/clinical-extractor';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';
import { useLocale } from 'next-intl';
import { useRouter } from '@/i18n/routing';

interface VoiceContextType {
  // State
  isOpen: boolean;
  state: VoiceState;
  amplitude: number;
  transcript: string;
  interimTranscript: string;
  messages: VoiceMessage[];
  config: VoiceConfig;
  privateMode: boolean;
  avatarVisible: boolean;
  dailyMinutesRemaining: number;
  hasPermission: boolean | null;
  errorText: string | null;

  // Actions
  openVoicePanel: () => void;
  closeVoicePanel: () => void;
  toggleVoicePanel: () => void;
  startPushToTalk: () => Promise<void>;
  stopPushToTalk: () => Promise<void>;
  speakText: (text: string, onEnd?: () => void) => Promise<void>;
  stopSpeech: () => void;
  setTranscript: (text: string) => void;
  submitTranscript: (textToSubmit?: string) => Promise<void>;
  setPrivateMode: (enabled: boolean) => void;
  setAvatarVisible: (visible: boolean) => void;
  setSpeechSpeed: (speed: number) => void;
  resetSession: () => void;
  clearMessages: () => void;
}

const DEFAULT_CONFIG: VoiceConfig = {
  enabled: true,
  kill_switch: false,
  stt_provider: 'browser',
  tts_provider: 'browser',
  persona_name: 'ডকমেট (DocMate)',
  persona_greeting_bn: 'স্বাগতম, ডাক্তার। বলুন, কীভাবে সাহায্য করতে পারি?',
  persona_greeting_en: 'Welcome, Doctor. How can I assist you today?',
  intro_disclaimer_bn: 'আমি একটি এআই সহকারী। চূড়ান্ত সিদ্ধান্ত আপনার।',
  intro_disclaimer_en: 'I am an AI assistant. The final decision is yours.',
  default_voice_gender: 'female',
  default_speed: 1.0,
  private_mode_default: true,
  avatar_enabled_default: true,
};

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const locale = useLocale() as 'bn' | 'en';
  const router = useRouter();
  const { openEvidence } = useEvidenceSheet();

  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [config, setConfig] = useState<VoiceConfig>(DEFAULT_CONFIG);
  const [privateMode, setPrivateMode] = useState(true);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [dailyMinutesRemaining] = useState(60);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const sttRef = useRef<SttProvider | null>(null);
  const ttsRef = useRef<TtsProvider | null>(null);
  const sessionIntroducedRef = useRef(false);

  // Initialize providers
  useEffect(() => {
    sttRef.current = createSttProvider(config.stt_provider);
    ttsRef.current = createTtsProvider(config.tts_provider);

    return () => {
      sttRef.current?.abortListening();
      ttsRef.current?.stop();
    };
  }, [config.stt_provider, config.tts_provider]);

  // Load global voice settings if available
  useEffect(() => {
    fetch('/api/settings/voice')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.config) {
          setConfig((prev) => ({ ...prev, ...data.config }));
          setPrivateMode(data.config.private_mode_default ?? true);
          setAvatarVisible(data.config.avatar_enabled_default ?? true);
        }
      })
      .catch(() => {});
  }, []);

  // Barge-in keyboard shortcut: Esc key stops ongoing speech immediately
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state === 'speaking') {
        ttsRef.current?.stop();
        setState('idle');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state]);

  const stopSpeech = useCallback(() => {
    ttsRef.current?.stop();
    setState('idle');
    setAmplitude(0);
  }, []);

  const speakText = useCallback(
    async (text: string, onEnd?: () => void) => {
      if (!text || !config.enabled || config.kill_switch) {
        onEnd?.();
        return;
      }

      stopSpeech();
      setState('speaking');

      // Add speech boundary simulator for amplitude if browser doesn't report it
      const synthInterval = setInterval(() => {
        setAmplitude(0.3 + Math.random() * 0.5);
      }, 120);

      try {
        await ttsRef.current?.speak({
          text,
          locale,
          rate: config.default_speed,
          voiceGender: config.default_voice_gender,
          onStart: () => {
            setState('speaking');
          },
          onEnd: () => {
            clearInterval(synthInterval);
            setAmplitude(0);
            setState('idle');
            onEnd?.();
          },
          onError: (err) => {
            clearInterval(synthInterval);
            setAmplitude(0);
            setState('idle');
            console.warn('[VoiceTTS Error]:', err);
            onEnd?.();
          },
        });
      } catch {
        clearInterval(synthInterval);
        setAmplitude(0);
        setState('idle');
        onEnd?.();
      }
    },
    [config.enabled, config.kill_switch, config.default_speed, config.default_voice_gender, locale, stopSpeech]
  );

  // Introduce once per session
  const introduceAssistantIfNeeded = useCallback(async () => {
    if (sessionIntroducedRef.current) return;
    sessionIntroducedRef.current = true;

    const greeting = locale === 'bn' ? config.persona_greeting_bn : config.persona_greeting_en;
    const intro = locale === 'bn' ? config.intro_disclaimer_bn : config.intro_disclaimer_en;
    const fullIntro = `${greeting} ${intro}`;

    setMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: 'assistant',
        text: fullIntro,
        timestamp: Date.now(),
        verified: true,
      },
    ]);

    await speakText(fullIntro);
  }, [config, locale, speakText]);

  const openVoicePanel = useCallback(() => {
    setIsOpen(true);
    introduceAssistantIfNeeded();
  }, [introduceAssistantIfNeeded]);

  const closeVoicePanel = useCallback(() => {
    stopSpeech();
    sttRef.current?.abortListening();
    setIsOpen(false);
  }, [stopSpeech]);

  const toggleVoicePanel = useCallback(() => {
    if (isOpen) closeVoicePanel();
    else openVoicePanel();
  }, [isOpen, openVoicePanel, closeVoicePanel]);

  const startPushToTalk = useCallback(async () => {
    if (dailyMinutesRemaining <= 0) {
      const limitText =
        locale === 'bn'
          ? 'আজকের ভয়েস সীমা শেষ। টাইপ করে চালিয়ে যান।'
          : 'Daily voice limit reached. Please continue by typing.';
      setErrorText(limitText);
      await speakText(limitText);
      return;
    }

    stopSpeech();
    setErrorText(null);
    setState('listening');
    setTranscript('');
    setInterimTranscript('');

    try {
      await sttRef.current?.startListening({
        locale,
        hints: ['Dengue', 'Pneumonia', 'Amoxicillin', 'Azithromycin', 'Paracetamol', 'রক্তচাপ', 'জ্বর', 'কাশি', 'শ্বাসকষ্ট'],
        onVolume: (vol) => {
          setAmplitude(vol);
        },
        onResult: (res) => {
          setHasPermission(true);
          if (res.isFinal) {
            setTranscript(res.text);
            setInterimTranscript('');
          } else {
            setInterimTranscript(res.text);
          }
        },
        onError: (err) => {
          setState('error');
          if (err === 'permission_denied') {
            setHasPermission(false);
            setErrorText(
              locale === 'bn'
                ? 'মাইক্রোফোনের অনুমতি প্রয়োজন। অনুগ্রহ করে ব্রাউজারের অনুমতি দিন।'
                : 'Microphone permission required. Please allow access in browser.'
            );
          } else {
            setErrorText(
              locale === 'bn'
                ? 'কথা বুঝতে পারিনি। আবার বলুন অথবা টাইপ করুন।'
                : 'Could not catch that. Please say again or type.'
            );
          }
        },
        onEnd: () => {
          if (state === 'listening') {
            setState('idle');
          }
        },
      });
    } catch {
      setState('error');
    }
  }, [dailyMinutesRemaining, locale, speakText, state, stopSpeech]);

  const submitTranscript = useCallback(
    async (textToSubmit?: string) => {
      const query = (textToSubmit ?? transcript ?? interimTranscript).trim();
      if (!query) {
        setState('idle');
        return;
      }

      // Add doctor message to bubble stream
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'doctor',
          text: query,
          timestamp: Date.now(),
        },
      ]);

      setState('thinking');
      const routing = routeVoiceIntent(query, locale);

      // 1. Blocked Action Safety Stop
      if (routing.blocked) {
        setState('alert');
        const alertMsg = routing.speakableResponse || (locale === 'bn' ? 'এটি স্ক্রিনে নিশ্চিত করুন।' : 'Please confirm this on screen.');
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: alertMsg,
            timestamp: Date.now(),
            intent: 'blocked_action',
            verified: true,
          },
        ]);
        await speakText(alertMsg);
        return;
      }

      // 2. Navigation Actions
      if (routing.intent === 'navigate') {
        if (routing.targetRoute === 'action:open_evidence') {
          openEvidence({
            chunk_id: 'default',
            source_title: 'Clinical Guideline Library',
            quote: query,
          });
        } else if (routing.targetRoute) {
          router.push(routing.targetRoute);
        }
        const navText = routing.speakableResponse || (locale === 'bn' ? 'স্ক্রিনে দেখাচ্ছি...' : 'Navigating...');
        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: navText,
            timestamp: Date.now(),
            intent: 'navigate',
            verified: true,
          },
        ]);
        await speakText(navText);
        return;
      }

      // 3. Clinical Dictation
      if (routing.intent === 'dictate') {
        const extracted = extractClinicalFacts(query, {
          age: 35,
          gender: 'male',
          chief_complaint: '',
          symptoms: [],
          past_medical_history: [],
          current_medicines: [],
          allergies: [],
          vitals: {},
          lab_values: [],
        });
        const dictateMsg =
          locale === 'bn'
            ? `আমি যা শুনলাম: ${extracted.length > 0 ? extracted.map((e) => e.display_value).join(', ') : query}। নিশ্চিত করতে স্ক্রিন দেখুন।`
            : `I understood: ${extracted.length > 0 ? extracted.map((e) => e.display_value).join(', ') : query}. Please confirm on screen.`;

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: dictateMsg,
            timestamp: Date.now(),
            intent: 'dictate',
            verified: true,
            draftUpdate: extracted,
          },
        ]);
        await speakText(dictateMsg);
        return;
      }

      // 4. Default: Ask Library via verified /api/ask pipeline
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query, locale }),
        });

        if (!res.ok) {
          const failMsg = locale === 'bn' ? 'লাইব্রেরি অনুসন্ধানে সমস্যা হয়েছে।' : 'Library query failed.';
          await speakText(failMsg);
          return;
        }

        const data = await res.json();
        const speakable = makeSpeakable(data, locale);

        setMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            sender: 'assistant',
            text: data.answer || speakable,
            speakableText: speakable,
            citations: data.citations || [],
            timestamp: Date.now(),
            intent: 'ask_library',
            verified: data.found ?? true,
          },
        ]);

        await speakText(speakable);
      } catch {
        setState('error');
        const errMsg = locale === 'bn' ? 'সংযোগ সমস্যা হয়েছে। টাইপ করে দেখুন।' : 'Network error. Please try typing.';
        setErrorText(errMsg);
        await speakText(errMsg);
      }
    },
    [transcript, interimTranscript, locale, speakText, openEvidence, router]
  );

  const stopPushToTalk = useCallback(async () => {
    setState('transcribing');
    await sttRef.current?.stopListening();
    // Submit after short debounce for speech finalization
    setTimeout(() => {
      submitTranscript();
    }, 250);
  }, [submitTranscript]);

  const resetSession = useCallback(() => {
    stopSpeech();
    sttRef.current?.abortListening();
    setState('idle');
    setTranscript('');
    setInterimTranscript('');
    setErrorText(null);
  }, [stopSpeech]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const setSpeechSpeed = useCallback((speed: number) => {
    setConfig((prev) => ({ ...prev, default_speed: Math.min(1.2, Math.max(0.8, speed)) }));
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        isOpen,
        state,
        amplitude,
        transcript,
        interimTranscript,
        messages,
        config,
        privateMode,
        avatarVisible,
        dailyMinutesRemaining,
        hasPermission,
        errorText,
        openVoicePanel,
        closeVoicePanel,
        toggleVoicePanel,
        startPushToTalk,
        stopPushToTalk,
        speakText,
        stopSpeech,
        setTranscript,
        submitTranscript,
        setPrivateMode,
        setAvatarVisible,
        setSpeechSpeed,
        resetSession,
        clearMessages,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const context = useContext(VoiceContext);
  if (!context) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}
