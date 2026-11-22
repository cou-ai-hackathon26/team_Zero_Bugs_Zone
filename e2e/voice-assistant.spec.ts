import { expect, test, type Page } from '@playwright/test';

interface SpokenLine {
  text: string;
  lang: string;
  rate: number;
  pitch: number;
  voice: string;
}

declare global {
  interface Window {
    voiceTestLines: SpokenLine[];
  }
}

async function mockDeviceSpeech(page: Page) {
  await page.addInitScript(() => {
    window.voiceTestLines = [];
    const synthesis = new EventTarget();
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        constructor(readonly text: string) {}
      },
    });
    const voices = [
      { name: 'Samantha', lang: 'en-US', localService: true },
      { name: 'Daniel', lang: 'en-GB', localService: true },
      { name: 'Piya', lang: 'bn-IN', localService: true },
    ];
    Object.defineProperty(window, 'speechSynthesis', {
      value: Object.assign(synthesis, {
        getVoices: () => voices,
        cancel: () => {},
        speak: (utterance: SpeechSynthesisUtterance) => {
          window.voiceTestLines.push({
            text: utterance.text,
            lang: utterance.lang,
            rate: utterance.rate,
            pitch: utterance.pitch,
            voice: utterance.voice?.name ?? '',
          });
          utterance.onstart?.(new Event('start') as SpeechSynthesisEvent);
          setTimeout(() => utterance.onend?.(new Event('end') as SpeechSynthesisEvent), 30);
        },
      }),
    });
  });
}

async function login(page: Page, role: 'doctor' | 'admin') {
  const response = await page.request.post('/api/auth/login', {
    data: { email: `${role}@docmate.ai`, password: 'demo123' },
  });
  expect(response.ok()).toBe(true);
}

test.describe('voice assistant on the synthetic fixture', () => {
  test.skip(process.env.DOCMATE_QA_SYNTHETIC !== '1', 'Requires a seeded synthetic database.');

  test('a saved personal voice is shared by preview and live greetings', async ({ page }) => {
    await login(page, 'doctor');
    await mockDeviceSpeech(page);
    await page.route('**/api/settings/assistant', (route) => route.fulfill({
      json: {
        persisted: true,
        preferences: {
          address_style: 'doctor', tone_preset: 'reserved', verbosity: 'normal',
          sounds_enabled: false, hints_enabled: true, avatar_enabled: true,
          speech_rate: 0.95, voice_id: 'male',
        },
      },
    }));
    await page.route('**/api/settings/voice', (route) => route.fulfill({ json: { config: { tts_provider: 'browser' } } }));

    await page.goto('/en/settings');
    const sample = page.getByRole('button', { name: 'Sample Voice' });
    await sample.click();
    await expect(sample).toBeEnabled();
    await page.getByRole('button', { name: 'Open DocMate Voice Assistant' }).click();
    await expect.poll(() => page.evaluate(() => window.voiceTestLines.length)).toBe(2);
    expect(await page.evaluate(() => window.voiceTestLines)).toMatchObject([
      { lang: 'en-GB', voice: 'Daniel', rate: 0.95, pitch: 1 },
      { lang: 'en-GB', voice: 'Daniel', rate: 0.95, pitch: 1 },
    ]);

    const input = page.getByPlaceholder('Edit transcript here or type...');
    await input.fill('quantum entanglement');
    const askResponse = page.waitForResponse((response) =>
      response.url().endsWith('/api/ask') && response.request().method() === 'POST',
    );
    await input.press('Enter');
    expect(await (await askResponse).json()).toMatchObject({ found: false, status: 'insufficient_evidence' });
    const abstention = 'I couldn’t find enough evidence in the library to answer that.';
    await expect(page.getByText(abstention, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.voiceTestLines.at(-1)?.text)).toBe(abstention);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('dialog').getByPlaceholder('Edit transcript here or type...')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('Maya outage keeps the greeting and later replies on the device voice', async ({ page }) => {
    await login(page, 'doctor');
    await mockDeviceSpeech(page);
    await page.route('**/api/settings/voice', (route) => route.fulfill({
      json: { config: { tts_provider: 'maya', persona_preset: 'friendly' } },
    }));
    let mayaRequests = 0;
    await page.route('**/api/voice/synthesize', (route) => {
      mayaRequests += 1;
      return route.fulfill({ status: 503 });
    });
    await page.goto('/en/settings');
    const greetingRequest = page.waitForRequest('**/api/voice/synthesize');
    await page.getByRole('button', { name: 'Open DocMate Voice Assistant' }).click();
    expect((await greetingRequest).postDataJSON()).toMatchObject({ provider: 'maya', locale: 'en', conversationTone: 'warm' });
    await expect.poll(() => page.evaluate(() => window.voiceTestLines[0])).toMatchObject({ lang: 'en-US', voice: 'Samantha' });

    const input = page.getByPlaceholder('Edit transcript here or type...');
    await input.fill('Hello!');
    await input.press('Enter');
    const text = 'Hi! I’m here. What would you like to look up?';
    await expect(page.getByText(text, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.voiceTestLines.at(-1))).toMatchObject({ text, lang: 'en-US', voice: 'Samantha' });
    await input.fill('Kemon achen?');
    await input.press('Enter');
    const banglaText = 'হ্যালো! আমি আছি। কী খুঁজে দেখতে চান?';
    await expect(page.getByText(banglaText, { exact: true })).toHaveAttribute('lang', 'bn');
    await expect(page.getByText('Microphone: Bangla')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.voiceTestLines.at(-1))).toMatchObject({ text: banglaText, lang: 'bn-IN', voice: 'Piya' });

    await input.fill('ধন্যবাদ।');
    await input.press('Enter');
    const customText = 'স্বাগতম। আর কিছু লাগলে বলবেন।';
    await expect(page.getByText(customText, { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.voiceTestLines.at(-1))).toMatchObject({ text: customText, lang: 'bn-IN', voice: 'Piya' });
    expect(mayaRequests).toBe(1);
  });

  test('the language selector sets microphone recognition and the library reply language', async ({ page }) => {
    await login(page, 'doctor');
    await mockDeviceSpeech(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: () => Promise.reject(new DOMException('Test microphone', 'NotAllowedError')),
      });
      Object.defineProperty(window, 'SpeechRecognition', { value: class {
        lang = '';
        start() {
          document.documentElement.dataset.recognitionLanguage = this.lang;
        }
        stop() {}
        abort() {}
      } });
    });
    await page.route('**/api/settings/voice', (route) => route.fulfill({ json: { config: { tts_provider: 'browser' } } }));
    await page.route('**/api/ask', (route) => route.fulfill({ json: { found: false, status: 'insufficient_evidence' } }));
    await page.goto('/en/settings');
    await page.getByRole('button', { name: 'Open DocMate Voice Assistant' }).click();

    const selector = page.getByRole('combobox', { name: 'Conversation language' });
    const mic = page.getByRole('button', { name: 'Hold mic to speak' });
    for (const [selection, browserLanguage] of [['bn', 'bn-BD'], ['en', 'en-US']]) {
      await selector.selectOption(selection);
      await mic.focus();
      await page.keyboard.down('Space');
      await expect(page.locator('html')).toHaveAttribute('data-recognition-language', browserLanguage);
      await page.keyboard.up('Space');
      await expect(selector).toBeEnabled();
    }

    await selector.selectOption('bn');
    const ask = page.waitForRequest('**/api/ask');
    const input = page.getByPlaceholder('Edit transcript here or type...');
    await input.fill('quantum entanglement');
    await input.press('Enter');
    expect((await ask).postDataJSON()).toEqual({ question: 'quantum entanglement', locale: 'bn' });
    await expect(page.getByText('এই প্রশ্নের উত্তর দেওয়ার মতো যথেষ্ট প্রমাণ লাইব্রেরিতে খুঁজে পাইনি।', { exact: true }))
      .toHaveAttribute('lang', 'bn');

    await page.route('**/api/ask', (route) => route.fulfill({ status: 500 }));
    await input.fill('another unrelated question');
    await input.press('Enter');
    await expect(page.getByText('লাইব্রেরিতে খুঁজতে পারিনি। আবার চেষ্টা করুন।', { exact: true }))
      .toHaveAttribute('lang', 'bn');
  });

  test('admin Bangla preview tries the selected cloud engine and falls back locally', async ({ page }) => {
    await login(page, 'admin');
    await mockDeviceSpeech(page);
    await page.route('**/api/settings/voice', (route) => route.fulfill({
      json: { config: { tts_provider: 'openai', default_speed: 0.95, persona_preset: 'friendly' } },
    }));
    await page.route('**/api/voice/synthesize', (route) => route.fulfill({ status: 503 }));
    await page.goto('/bn/admin/voice');
    await page.getByRole('tab', { name: 'ভয়েস ইঞ্জিন ও কিল-সুইচ' }).click();
    const request = page.waitForRequest('**/api/voice/synthesize');
    const testAudio = page.getByRole('button', { name: 'শব্দ পরীক্ষা' });
    await testAudio.click();
    expect((await request).postDataJSON()).toMatchObject({ locale: 'bn', rate: 0.95, style: 'warm' });
    await expect.poll(() => page.evaluate(() => window.voiceTestLines[0])).toMatchObject({
      lang: 'bn-IN', voice: 'Piya', rate: 0.95, pitch: 1.04,
    });
    await expect(testAudio).toBeEnabled();
  });
});
