import { cookies } from 'next/headers';
import crypto from 'crypto';
import { User, UserRole } from '@/types';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

import { promisify } from 'node:util';
import { COOKIE_NAME, createSessionToken, requireAuthSecret, verifySessionToken } from '@/lib/session';

const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (/^[a-f0-9]{64}$/.test(stored)) {
    const legacy = crypto.createHmac('sha256', requireAuthSecret()).update(password).digest();
    return crypto.timingSafeEqual(legacy, Buffer.from(stored, 'hex'));
  }

  const format = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/.exec(stored);
  if (!format) return false;
  const key = await scrypt(password, format[1], 64) as Buffer;
  return crypto.timingSafeEqual(key, Buffer.from(format[2], 'hex'));
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const record = await db.query.users.findFirst({ where: eq(users.id, session.id) });
  if (!record) return null;
  return {
    id: record.id,
    email: record.email,
    role: record.role as UserRole,
    name: record.name,
    created_at: record.createdAt.toISOString(),
  };
}

export async function setAuthCookie(user: { id: string; email: string; role: UserRole; name: string }) {
  const token = await createSessionToken(user);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
