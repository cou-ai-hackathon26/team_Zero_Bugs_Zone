import { TtsProvider, TtsSpeakOptions } from './types';
import { audioCache } from './audio-cache';
import { segmentForSpeech } from '../language/speech-segmenter';

/**
 * Browser Speech Synthesis API implementation of TtsProvider
 */
export class BrowserSpeechSynthesisTTS implements TtsProvider {
  public name = 'browser_speech_synthesis';
  private currentUtterance: SpeechSynthesisUtterance | null = null;

  public isAvailable(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  public async speak(options: TtsSpeakOptions): Promise<void> {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onError?.('browser_unsupported');
      return;
    }

    // Stop any ongoing speech (barge-in support)
    this.stop();

    const cleanText = options.text.trim();
    if (!cleanText) {
      options.onEnd?.();
      return;
    }

    // Check audio cache
    const cachedUri = await audioCache.get(cleanText, options.locale, options.voiceGender, options.rate);
    if (cachedUri) {
      const audio = new Audio(cachedUri);
      audio.playbackRate = options.rate || 1.0;
      audio.onplay = () => options.onStart?.();
      audio.onended = () => options.onEnd?.();
      audio.onerror = () => options.onError?.('cached_audio_playback_failed');
      try {
        await audio.play();
        return;
      } catch {
        // Fall back to synthesis if autoplay blocked
      }
    }

    const segments = segmentForSpeech(cleanText);
    const voices = window.speechSynthesis.getVoices();

    const getVoiceForLang = (lang: 'bn' | 'en') => {
      if (lang === 'bn') {
        return (
          voices.find((v) => v.lang === 'bn-BD' || v.lang === 'bn_BD') ||
          voices.find((v) => v.lang === 'bn-IN' || v.lang === 'bn_IN') ||
          voices.find((v) => v.lang.startsWith('bn'))
        );
      }
      return (
        voices.find(
          (v) =>
            v.lang === 'en-US' &&
            (options.voiceGender === 'female'
              ? v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('Zira')
              : true)
        ) || voices.find((v) => v.lang.startsWith('en'))
      );
    };

    if (segments.length > 1) {
      let segmentIndex = 0;
      const speakNextSegment = () => {
        if (segmentIndex >= segments.length) {
          this.currentUtterance = null;
          options.onEnd?.();
          return;
        }

        const seg = segments[segmentIndex];
        const segUtterance = new SpeechSynthesisUtterance(seg.text);
        this.currentUtterance = segUtterance;
        segUtterance.rate = Math.min(1.2, Math.max(0.8, options.rate || 1.0));
        segUtterance.lang = seg.lang === 'bn' ? 'bn-BD' : 'en-US';

        const matchedVoice = getVoiceForLang(seg.lang);
        if (matchedVoice) segUtterance.voice = matchedVoice;

        if (segmentIndex === 0) {
          segUtterance.onstart = () => options.onStart?.();
        }

        segUtterance.onend = () => {
          segmentIndex++;
          speakNextSegment();
        };

        segUtterance.onerror = (e) => {
          this.currentUtterance = null;
          if (e.error === 'canceled' || e.error === 'interrupted') return;
          options.onError?.(e.error || 'speech_synthesis_failed');
        };

        window.speechSynthesis.speak(segUtterance);
      };

      speakNextSegment();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.currentUtterance = utterance;

    // Rate bounds 0.8x to 1.2x
    utterance.rate = Math.min(1.2, Math.max(0.8, options.rate || 1.0));
    utterance.pitch = 1.0;
    utterance.lang = options.locale === 'bn' ? 'bn-BD' : 'en-US';

    const matchedVoice = getVoiceForLang(options.locale === 'bn' ? 'bn' : 'en');
    if (matchedVoice) utterance.voice = matchedVoice;

    utterance.onstart = () => {
      options.onStart?.();
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (e) => {
      this.currentUtterance = null;
      if (e.error === 'canceled' || e.error === 'interrupted') {
        // Normal stop/barge-in
        return;
      }
      options.onError?.(e.error || 'speech_synthesis_failed');
    };

    utterance.onboundary = (event) => {
      const word = cleanText.substring(event.charIndex, event.charIndex + (event.charLength || 10));
      options.onBoundary?.(event.charIndex, word);
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.currentUtterance = null;
    }
  }

  public pause(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  }

  public resume(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
  }
}

/**
 * OpenAI TTS implementation of TtsProvider
 * Calls /api/voice/synthesize and plays audio buffer
 */
export class OpenAiTTS implements TtsProvider {
  public name = 'openai_tts';
  private currentAudio: HTMLAudioElement | null = null;

  public isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  public async speak(options: TtsSpeakOptions): Promise<void> {
    this.stop();
    const cleanText = options.text.trim();
    if (!cleanText) {
      options.onEnd?.();
      return;
    }

    try {
      options.onStart?.();
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          locale: options.locale,
          rate: options.rate || 1.0,
          gender: options.voiceGender || 'female',
        }),
      });

      if (!res.ok) {
        options.onError?.('synthesize_api_failed');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      await audioCache.set(cleanText, options.locale, url, options.voiceGender, options.rate);

      this.currentAudio = new Audio(url);
      this.currentAudio.playbackRate = options.rate || 1.0;
      this.currentAudio.onended = () => {
        this.currentAudio = null;
        options.onEnd?.();
      };
      this.currentAudio.onerror = () => {
        this.currentAudio = null;
        options.onError?.('playback_failed');
      };

      await this.currentAudio.play();
    } catch {
      options.onError?.('network_error');
    }
  }

  public stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }
}

/**
 * Stub TTS Provider for testing or server-side execution
 */
export class StubTTS implements TtsProvider {
  public name = 'stub_tts';
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  public isAvailable(): boolean {
    return true;
  }

  public async speak(options: TtsSpeakOptions): Promise<void> {
    options.onStart?.();
    this.timeoutId = setTimeout(() => {
      options.onEnd?.();
    }, 150);
  }

  public stop(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export function createTtsProvider(type: 'browser' | 'openai' | 'custom_stub' = 'browser'): TtsProvider {
  if (type === 'openai') return new OpenAiTTS();
  if (type === 'custom_stub') return new StubTTS();
  return new BrowserSpeechSynthesisTTS();
}
