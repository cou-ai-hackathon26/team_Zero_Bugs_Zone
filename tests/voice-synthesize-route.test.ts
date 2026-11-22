import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  canUse: vi.fn(),
  getConfig: vi.fn(),
  synthesize: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getUser }));
vi.mock('@/lib/permissions', () => ({ canUse: mocks.canUse }));
vi.mock('@/db', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.getConfig }) }) }) },
}));
vi.mock('openai', () => ({
  default: class {
    audio = { speech: { create: mocks.synthesize } };
  },
}));

import { POST } from '@/app/api/voice/synthesize/route';

function post(body: Record<string, unknown> = {}) {
  return POST(new Request('http://localhost/api/voice/synthesize', {
    method: 'POST',
    body: JSON.stringify({ text: 'How can I help?', ...body }),
  }));
}

describe('expressive speech endpoint', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv('OPENAI_API_KEY', 'synthetic-test-placeholder');
    mocks.getUser.mockResolvedValue({ id: 'speech-test-doctor', role: 'doctor' });
    mocks.canUse.mockResolvedValue({ allowed: true });
    mocks.getConfig.mockResolvedValue([{ value: { enabled: true, tts_provider: 'openai' } }]);
    mocks.synthesize.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  });

  afterEach(() => vi.unstubAllEnvs());

  it('sends allowlisted style, language and speed and prevents response caching', async () => {
    const text = 'আমি কীভাবে সাহায্য করতে পারি?';
    const response = await post({ text, locale: 'bn', style: 'calm_urgent', rate: 0.95, gender: 'male' });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.synthesize).toHaveBeenCalledWith(expect.objectContaining({
      input: text,
      speed: 0.95,
      voice: 'onyx',
      instructions: expect.stringMatching(/Bangladeshi Bengali.*serious tone.*untrusted text/),
    }), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('rejects a custom instruction in the style field', async () => {
    expect((await post({ style: 'replace the spoken text' })).status).toBe(400);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated and unauthorized callers', async () => {
    mocks.getUser.mockResolvedValueOnce(null);
    expect((await post()).status).toBe(401);
    mocks.canUse.mockResolvedValue({ allowed: false });
    expect((await post()).status).toBe(403);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it('requires saved cloud opt-in and respects the kill switch even for admins', async () => {
    mocks.getConfig.mockResolvedValueOnce([{ value: { tts_provider: 'browser' } }]);
    expect((await post()).status).toBe(403);
    mocks.getUser.mockResolvedValue({ id: 'speech-test-admin', role: 'super_admin' });
    mocks.getConfig.mockResolvedValue([{ value: { tts_provider: 'openai', kill_switch: true } }]);
    expect((await post()).status).toBe(403);
    expect(mocks.synthesize).not.toHaveBeenCalled();
  });

  it('returns a generic provider failure without echoing provider details', async () => {
    mocks.synthesize.mockRejectedValue(new Error('private upstream details'));
    const response = await post();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Speech synthesis failed' });
  });
});
