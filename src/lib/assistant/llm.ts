import OpenAI from 'openai';
import { getRawAiCredentials } from '@/lib/ai-credentials';
import type { LlmMessage, LlmStreamer } from './types';

// OpenAI-compatible endpoints for providers that expose one.
const DEFAULT_BASE_URLS: Record<string, string | undefined> = {
  openai: undefined,
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/',
  anthropic: 'https://api.anthropic.com/v1/',
  custom: undefined,
};

const FIRST_TOKEN_TIMEOUT_MS = 20_000;
const TOTAL_TIMEOUT_MS = 45_000;

export interface ChatModel {
  stream: LlmStreamer;
  model: string;
}

/**
 * Returns a streaming chat client from the admin AI credentials (or env), or
 * null when no key is configured. The key never leaves the server.
 */
export async function getChatModel(): Promise<ChatModel | null> {
  if (process.env.DOCMATE_DISABLE_LLM === '1') return null;
  const credentials = await getRawAiCredentials();
  if (!credentials?.apiKey) return null;

  const provider = credentials.provider || 'openai';
  const baseURL = credentials.baseUrl?.trim() || DEFAULT_BASE_URLS[provider];
  if (provider === 'custom' && !baseURL) return null;

  const client = new OpenAI({ apiKey: credentials.apiKey, baseURL, maxRetries: 1 });
  const model = credentials.model?.trim() || process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';

  const stream: LlmStreamer = async function* (messages: LlmMessage[], signal: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort, { once: true });
    let firstTokenTimer: ReturnType<typeof setTimeout> | undefined = setTimeout(abort, FIRST_TOKEN_TIMEOUT_MS);
    const totalTimer = setTimeout(abort, TOTAL_TIMEOUT_MS);

    try {
      const response = await client.chat.completions.create(
        { model, messages, stream: true, temperature: 0.2, max_tokens: 1200 },
        { signal: controller.signal },
      );
      for await (const chunk of response) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          if (firstTokenTimer) {
            clearTimeout(firstTokenTimer);
            firstTokenTimer = undefined;
          }
          yield delta;
        }
      }
    } finally {
      if (firstTokenTimer) clearTimeout(firstTokenTimer);
      clearTimeout(totalTimer);
      signal.removeEventListener('abort', abort);
    }
  };

  return { stream, model };
}
