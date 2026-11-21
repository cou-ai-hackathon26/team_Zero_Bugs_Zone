import { UserRole } from '@/types';

export const AUTH_SECRET = process.env.AUTH_SECRET || 'docmate_hackathon_super_secret_demo_token_key_2026';
export const COOKIE_NAME = 'docmate_session';

export interface SessionPayload {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  exp: number;
}

/**
 * Universal Web Crypto token generator (Edge & Node compatible)
 */
export async function createSessionTokenWeb(user: {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}): Promise<string> {
  const payload: SessionPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };

  const jsonStr = JSON.stringify(payload);
  const data = typeof Buffer !== 'undefined' 
    ? Buffer.from(jsonStr).toString('base64url')
    : btoa(unescape(encodeURIComponent(jsonStr))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(AUTH_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signature = typeof Buffer !== 'undefined'
    ? Buffer.from(sigBuffer).toString('base64url')
    : btoa(String.fromCharCode(...new Uint8Array(sigBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${data}.${signature}`;
}

/**
 * Universal Web Crypto token verifier (Edge & Node compatible)
 */
export async function verifySessionTokenWeb(token: string): Promise<SessionPayload | null> {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [data, signature] = parts;
    if (!data || !signature) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(AUTH_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
    const expectedSig = typeof Buffer !== 'undefined'
      ? Buffer.from(sigBuffer).toString('base64url')
      : btoa(String.fromCharCode(...new Uint8Array(sigBuffer))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (signature !== expectedSig) {
      return null;
    }

    const jsonStr = typeof Buffer !== 'undefined'
      ? Buffer.from(data, 'base64url').toString('utf-8')
      : decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/'))));

    const payload = JSON.parse(jsonStr) as SessionPayload;
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
