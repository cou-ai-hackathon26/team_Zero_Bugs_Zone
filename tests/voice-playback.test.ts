import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { segmentForSpeech } from '@/lib/language/speech-segmenter';
import { formatDoseForSpeech } from '@/lib/voice/dose-speech';
import { BrowserSpeechSynthesisTTS, OpenAiTTS } from '@/lib/voice/tts-provider';

class FakeUtterance {
  constructor(readonly text: string) {}
  onstart?: () => void;
  onend?: () => void;
}

const english = { name: 'Samantha', lang: 'en-US', localService: true };
const bangla = { name: 'Piya', lang: 'bn-IN', localService: true };

class FakeSynthesis extends EventTarget {
  getVoices = vi.fn(() => [bangla, english]);
  speak = vi.fn<(utterance: FakeUtterance) => void>();
  cancel = vi.fn();
}

describe('voice playback', () => {
  let synth: FakeSynthesis;

  beforeEach(() => {
    synth = new FakeSynthesis();
    vi.stubGlobal('window', { speechSynthesis: synth });
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('keeps questions, decimals, and medication units intact', () => {
    const text = 'Any changes? The record shows 2.5 mg. No dose was changed!';
    expect(segmentForSpeech(text, 'bn')).toEqual([{ text, lang: 'en' }]);
  });

  it('keeps a parenthetical English term inside a Bangla utterance', () => {
    const text = 'রোগীর নিউমোনিয়া (Pneumonia) রয়েছে।';
    expect(segmentForSpeech(text, 'en')).toEqual([{ text, lang: 'bn' }]);
  });

  it('uses the sentence language and native voice region independently of UI language', async () => {
    const done = vi.fn();
    const provider = new BrowserSpeechSynthesisTTS();
    await provider.speak({
      text: 'How can I help? কোন তথ্যটি দেখতে চান?',
      locale: 'bn',
      style: 'warm',
      rate: 0.95,
      onEnd: done,
    });
    const first = synth.speak.mock.calls[0][0];
    expect(first).toMatchObject({ text: 'How can I help?', lang: 'en-US', voice: english, rate: 0.95, pitch: 1.04 });
    first.onend?.();
    const second = synth.speak.mock.calls[1][0];
    expect(second).toMatchObject({ text: 'কোন তথ্যটি দেখতে চান?', lang: 'bn-IN', voice: bangla });
    second.onend?.();
    expect(done).toHaveBeenCalledOnce();
  });

  it('does not queue another sentence after stopping', async () => {
    const provider = new BrowserSpeechSynthesisTTS();
    const onEnd = vi.fn();
    await provider.speak({ text: 'How can I help? কী দেখতে চান?', locale: 'en', onEnd });
    provider.stop();
    synth.speak.mock.calls[0][0].onend?.();
    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(synth.speak).toHaveBeenCalledOnce();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('falls back to a local voice on a cloud failure', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', request);
    const start = vi.fn();
    await new OpenAiTTS().speak({ text: 'How can I help?', locale: 'bn', rate: 0.95, style: 'warm', onStart: start });
    const options = request.mock.calls[0][1];
    expect(JSON.parse(options?.body as string)).toMatchObject({ locale: 'en', rate: 0.95, style: 'warm' });
    expect(synth.speak.mock.calls[0][0]).toMatchObject({ lang: 'en-US', pitch: 1.04 });
    expect(start).not.toHaveBeenCalled();
    synth.speak.mock.calls[0][0].onstart?.();
    expect(start).toHaveBeenCalledOnce();
  });

  it('does not start local playback when a stopped cloud request eventually responds', async () => {
    let respond!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })));
    const provider = new OpenAiTTS();
    const playing = provider.speak({ text: 'How can I help?', locale: 'en' });
    provider.stop();
    respond(new Response(null, { status: 503 }));
    await playing;
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it.each(['', 'custom', 'constructor'])('does not invent a schedule for %j', (dosingSchedule) => {
    expect(formatDoseForSpeech({ dosingSchedule }, 'en')).toMatch(/check the prescription on screen/);
    expect(formatDoseForSpeech({ dosingSchedule }, 'bn')).toMatch(/পর্দায় প্রেসক্রিপশন দেখুন/);
  });

  it('does not infer meal timing and preserves a duration of thirty days', () => {
    const item = { dosingSchedule: '1+0+0', durationDays: 30 };
    expect(formatDoseForSpeech(item, 'en')).toBe('Medicine: one in the morning for thirty days.');
    expect(formatDoseForSpeech(item, 'bn')).toBe('ওষুধ: সকালে একটি, ত্রিশ দিন।');
  });
});
