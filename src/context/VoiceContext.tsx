'use client';

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { VoiceState, VoiceConfig, VoiceMessage, SttProvider, TtsProvider, TtsSpeakOptions } from '@/lib/voice/types';
import { createSttProvider } from '@/lib/voice/stt-provider';
import { createTtsProvider } from '@/lib/voice/tts-provider';
import { routeVoiceIntent } from '@/lib/voice/intent-router';
import { extractClinicalFacts } from '@/lib/clinical-extractor';
import { useEvidenceSheet } from '@/context/EvidenceSheetContext';
import { earconManager } from '@/lib/voice/earcons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';

type SpeechOverrides = Pick<TtsSpeakOptions, 'rate' | 'voiceGender' | 'style'> & {
  provider?: VoiceConfig['tts_provider'];
  preview?: boolean;
  scripted?: boolean;
};

type SpeechPreferences = {
  tone_preset: 'friendly' | 'reserved';
  speech_rate: number;
  voice_id: string;
  avatar_enabled: boolean;
  sounds_enabled: boolean;
};

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
  speakText: (text: string, onEnd?: (error?: string) => void, overrides?: SpeechOverrides) => Promise<void>;
  stopSpeech: () => void;
  setTranscript: (text: string) => void;
  submitTranscript: (textToSubmit?: string) => Promise<void>;
  setPrivateMode: (enabled: boolean) => void;
  setAvatarVisible: (visible: boolean) => void;
  applySystemVoiceConfig: (config: Partial<VoiceConfig>) => void;
  applySpeechPreferences: (preferences: SpeechPreferences) => void;
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
  const t = useTranslations('voice');
  const router = useRouter();
  const { openEvidence } = useEvidenceSheet();

  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useState<VoiceState>('idle');
  const [amplitude, setAmplitude] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [systemConfig, setSystemConfig] = useState<VoiceConfig>(DEFAULT_CONFIG);
  const [speechPreferences, setSpeechPreferences] = useState<SpeechPreferences | null>(null);
  const [speedOverride, setSpeedOverride] = useState<number>();
  const config: VoiceConfig = {
    ...systemConfig,
    default_speed: speedOverride ?? speechPreferences?.speech_rate ?? systemConfig.default_speed,
    default_voice_gender: speechPreferences?.voice_id === 'male' || speechPreferences?.voice_id === 'female'
      ? speechPreferences.voice_id
      : systemConfig.default_voice_gender,
    sounds_enabled: speechPreferences?.sounds_enabled ?? systemConfig.sounds_enabled,
  };
  const tone = speechPreferences?.tone_preset ?? systemConfig.persona_preset;
  const [privateMode, setPrivateMode] = useState(true);
  const [avatarVisible, setAvatarVisible] = useState(true);
  const [dailyMinutesRemaining] = useState(60);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const sttRef = useRef<SttProvider | null>(null);
  const capturedTranscriptRef = useRef('');
  const pendingSubmitRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playbackRef = useRef<{
    provider: TtsProvider;
    interval?: ReturnType<typeof setInterval>;
    complete?: (error?: string) => void;
    preview?: boolean;
  } | null>(null);
  const sessionIntroducedRef = useRef(false);
  const reassuranceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interruptionPromptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speakTextRef = useRef<VoiceContextType['speakText'] | null>(null);

  // Initialize providers
  useEffect(() => {
    sttRef.current = createSttProvider(config.stt_provider);

    return () => {
      sttRef.current?.abortListening();
      clearTimeout(pendingSubmitRef.current);
      if (reassuranceTimerRef.current) clearTimeout(reassuranceTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      if (interruptionPromptTimerRef.current) clearTimeout(interruptionPromptTimerRef.current);
    };
  }, [config.stt_provider]);

  const releaseSpeech = useCallback(() => {
    const playback = playbackRef.current;
    playbackRef.current = null;
    if (!playback) return;
    clearInterval(playback.interval);
    playback.provider.stop();
    return playback;
  }, []);

  useEffect(() => () => { releaseSpeech(); }, [releaseSpeech]);

  const applySpeechPreferences = useCallback((preferences: SpeechPreferences) => {
    setSpeechPreferences(preferences);
    setAvatarVisible(preferences.avatar_enabled);
    setSpeedOverride(undefined);
  }, []);

  const applySystemVoiceConfig = useCallback((voice: Partial<VoiceConfig>) => {
    setSystemConfig((previous) => ({ ...previous, ...voice }));
  }, []);

  // Load global voice settings and doctor persona preferences if available
  useEffect(() => {
    const load = async (path: string) => {
      const response = await fetch(path);
      return response.ok ? response.json() : null;
    };
    let active = true;
    void Promise.allSettled([load('/api/settings/voice'), load('/api/settings/assistant')])
      .then(([global, personal]) => {
        if (!active) return;
        const voice = global.status === 'fulfilled' ? global.value?.config : null;
        if (voice) {
          setSystemConfig((previous) => ({ ...previous, ...voice }));
          setPrivateMode(voice.private_mode_default ?? true);
          setAvatarVisible(voice.avatar_enabled_default ?? true);
        }
        if (personal.status === 'fulfilled' && personal.value?.persisted) {
          applySpeechPreferences(personal.value.preferences);
        }
      });
    return () => { active = false; };
  }, [applySpeechPreferences]);

  const stopSpeech = useCallback((isUserInterruption = false) => {
    if (interruptionPromptTimerRef.current) clearTimeout(interruptionPromptTimerRef.current);
    const playback = releaseSpeech();
    setState('idle');
    setAmplitude(0);
    playback?.complete?.();

    // Offer to continue when a live voice turn is interrupted with Escape.
    if (isUserInterruption && playback && !playback.preview) {
      interruptionPromptTimerRef.current = setTimeout(() => {
        void speakTextRef.current?.(t('continueSpeaking'), undefined, { scripted: true });
      }, 1200);
    }
  }, [releaseSpeech, t]);

  // Barge-in keyboard shortcut: Esc key stops ongoing speech immediately (< 200ms)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && state === 'speaking') {
        stopSpeech(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, stopSpeech]);

  const speakText = useCallback<VoiceContextType['speakText']>(
    async (text, onEnd, overrides) => {
      if (!text.trim() || !config.enabled || config.kill_switch) {
        onEnd?.(text.trim() ? t('speechDisabled') : undefined);
        return;
      }
      stopSpeech();
      setState('speaking');
      setErrorText(null);
      // Only scripted messages use an expressive cloud model. Readback of
      // case text, doses and library excerpts stays on the device.
      const providerType = overrides?.preview || overrides?.scripted
        ? overrides?.provider ?? config.tts_provider
        : 'browser';
      const provider = createTtsProvider(providerType === 'custom_stub' ? 'browser' : providerType);
      const playback: NonNullable<typeof playbackRef.current> = {
        provider,
        complete: onEnd,
        preview: overrides?.preview,
      };
      playbackRef.current = playback;

      const finish = (error?: string) => {
        if (playbackRef.current !== playback) return;
        releaseSpeech();
        setAmplitude(0);
        setState('idle');
        if (error && !overrides?.preview) setErrorText(error);
        onEnd?.(error);
      };

      try {
        await provider.speak({
          text,
          locale,
          rate: overrides?.rate ?? config.default_speed,
          voiceGender: overrides?.voiceGender ?? config.default_voice_gender,
          style: overrides?.style ?? (tone === 'reserved' ? 'neutral' : 'warm'),
          onStart: () => {
            if (playbackRef.current !== playback || playback.interval) return;
            playback.interval = setInterval(() => setAmplitude(0.3 + Math.random() * 0.5), 120);
          },
          onEnd: () => finish(),
          onError: (code) => finish(t(code === 'local_voice_unavailable' ? 'localVoiceUnavailable' : 'speechPlaybackFailed')),
        });
      } catch {
        finish(t('speechPlaybackFailed'));
      }
    },
    [config.enabled, config.kill_switch, config.tts_provider, config.default_speed,
      config.default_voice_gender, tone, locale, releaseSpeech, stopSpeech, t]
  );

  useEffect(() => {
    speakTextRef.current = speakText;
  }, [speakText]);

  // Introduce once per session
  const introduceAssistantIfNeeded = useCallback(async () => {
    if (sessionIntroducedRef.current) return;
    sessionIntroducedRef.current = true;

    const greeting = locale === 'bn' ? systemConfig.persona_greeting_bn : systemConfig.persona_greeting_en;
    const intro = locale === 'bn' ? systemConfig.intro_disclaimer_bn : systemConfig.intro_disclaimer_en;
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

    await speakText(fullIntro, undefined, { scripted: true });
  }, [systemConfig, locale, speakText]);

  const openVoicePanel = useCallback(() => {
    setIsOpen(true);
    introduceAssistantIfNeeded();
  }, [introduceAssistantIfNeeded]);

  const closeVoicePanel = useCallback(() => {
    stopSpeech();
    sttRef.current?.abortListening();
    clearTimeout(pendingSubmitRef.current);
    setIsOpen(false);
  }, [stopSpeech]);

  const toggleVoicePanel = useCallback(() => {
    if (isOpen) closeVoicePanel();
    else openVoicePanel();
  }, [isOpen, openVoicePanel, closeVoicePanel]);

  const startPushToTalk = useCallback(async () => {
    if (interruptionPromptTimerRef.current) {
      clearTimeout(interruptionPromptTimerRef.current);
      interruptionPromptTimerRef.current = null;
    }

    if (dailyMinutesRemaining <= 0) {
      const limitText =
        locale === 'bn'
          ? 'আজকের ভয়েস সীমা শেষ। টাইপ করে চালিয়ে যান।'
          : 'Daily voice limit reached. Please continue by typing.';
      setErrorText(limitText);
      await speakText(limitText);
      return;
    }

    stopSpeech(false);
    earconManager.playStart(config.sounds_enabled ?? true);
    setErrorText(null);
    setState('listening');
    clearTimeout(pendingSubmitRef.current);
    capturedTranscriptRef.current = '';
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
            capturedTranscriptRef.current = res.text;
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
          setState((current) => current === 'listening' ? 'idle' : current);
        },
      });
    } catch {
      setState('error');
    }
  }, [dailyMinutesRemaining, locale, speakText, stopSpeech, config.sounds_enabled]);

  const submitTranscript = useCallback(
    async (textToSubmit?: string) => {
      if (interruptionPromptTimerRef.current) {
        clearTimeout(interruptionPromptTimerRef.current);
        interruptionPromptTimerRef.current = null;
      }
  
      const query = (textToSubmit ?? transcript).trim();
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

      // Clear any previous reassurance or timeout timers
      if (reassuranceTimerRef.current) clearTimeout(reassuranceTimerRef.current);
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);

      // 6-second reassurance timer
      reassuranceTimerRef.current = setTimeout(() => {
        const reassureMsg = locale === 'bn' ? 'আর একটু সময় লাগছে।' : 'Taking a bit more time.';
        void speakText(reassureMsg, undefined, { scripted: true });
      }, 6000);

      // 15-second switch-to-typing advisory
      timeoutTimerRef.current = setTimeout(() => {
        const advisoryMsg =
          locale === 'bn'
            ? 'সময় বেশি লাগছে। টাইপ করে দেখতে পারেন।'
            : 'Taking longer than usual. You can continue by typing.';
        setErrorText(advisoryMsg);
      }, 15000);

      const clearThinkingTimers = () => {
        if (reassuranceTimerRef.current) {
          clearTimeout(reassuranceTimerRef.current);
          reassuranceTimerRef.current = null;
        }
        if (timeoutTimerRef.current) {
          clearTimeout(timeoutTimerRef.current);
          timeoutTimerRef.current = null;
        }
      };

      const routing = routeVoiceIntent(query, locale);

      // 1. Blocked Action Safety Stop
      if (routing.blocked) {
        clearThinkingTimers();
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
        await speakText(alertMsg, undefined, { style: 'calm_urgent', scripted: true });
        return;
      }

      // 2. Navigation Actions
      if (routing.intent === 'navigate') {
        clearThinkingTimers();
        let navText = routing.speakableResponse ?? '';
        if (routing.targetRoute === 'action:open_evidence') {
          const recentResult = [...messages].reverse().find((message) => message.intent === 'ask_library');
          const citation = recentResult?.citations?.find((item) => item.chunk_id && item.quote);
          if (citation) {
            openEvidence(citation);
          } else {
            navText = t('noEvidenceToOpen');
          }
        } else if (routing.targetRoute === 'action:go_back') {
          router.back();
        } else if (routing.targetRoute?.startsWith('/')) {
          router.push(routing.targetRoute);
        } else {
          navText = t('useScreenControls');
        }
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
        await speakText(navText, undefined, { scripted: true });
        return;
      }

      // 3. Clinical Dictation
      if (routing.intent === 'dictate') {
        clearThinkingTimers();
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
        if (privateMode) {
          await speakText(t('reviewDictation'), undefined, { scripted: true });
        } else {
          await speakText(dictateMsg);
        }
        return;
      }

      // 4. Default: Ask Library via verified /api/ask pipeline
      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: query, locale }),
        });

        clearThinkingTimers();

        if (!res.ok) {
          const failMsg = locale === 'bn' ? 'লাইব্রেরি অনুসন্ধানে সমস্যা হয়েছে।' : 'Library query failed.';
          await speakText(failMsg, undefined, { scripted: true });
          return;
        }

        const data = await res.json();
        const speakable = data.found === true && data.citations?.length
          ? t('reviewLibraryEvidence')
          : t('libraryAbstained');

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

        await speakText(speakable, undefined, {
          // Ask returns fixed status text alongside the on-screen verbatim excerpts.
          scripted: true,
        });
      } catch {
        clearThinkingTimers();
        setState('error');
        const errMsg = locale === 'bn' ? 'সংযোগ সমস্যা হয়েছে। টাইপ করে দেখুন।' : 'Network error. Please try typing.';
        setErrorText(errMsg);
        await speakText(errMsg);
      }
    },
    [transcript, locale, messages, privateMode, speakText, openEvidence, router, t]
  );

  const stopPushToTalk = useCallback(async () => {
    earconManager.playStop(config.sounds_enabled ?? true);
    setState('transcribing');
    await sttRef.current?.stopListening();
    // Submit after short debounce for speech finalization
    clearTimeout(pendingSubmitRef.current);
    pendingSubmitRef.current = setTimeout(() => {
      if (capturedTranscriptRef.current) {
        void submitTranscript(capturedTranscriptRef.current);
      } else {
        setState((current) => current === 'transcribing' ? 'idle' : current);
      }
    }, 250);
  }, [submitTranscript, config.sounds_enabled]);

  const resetSession = useCallback(() => {
    stopSpeech();
    sttRef.current?.abortListening();
    setState('idle');
    clearTimeout(pendingSubmitRef.current);
    capturedTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');
    setErrorText(null);
  }, [stopSpeech]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const setSpeechSpeed = useCallback((speed: number) => {
    setSpeedOverride(Math.min(1.2, Math.max(0.8, speed)));
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
        applySystemVoiceConfig,
        applySpeechPreferences,
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
