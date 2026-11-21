import { cookies } from 'next/headers';
import crypto from 'crypto';
import { User, UserRole } from '@/types';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

const AUTH_SECRET = process.env.AUTH_SECRET || 'docmate_hackathon_super_secret_demo_token_key_2026';
const COOKIE_NAME = 'docmate_session';

export function hashPassword(password: string): string {
  return crypto.createHmac('sha256', AUTH_SECRET).update(password).digest('hex');
}

export function createSessionToken(user: { id: string; email: string; role: UserRole; name: string }): string {
  const payload = JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  });
  const data = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
  return `${data}.${signature}`;
}

export function verifySessionToken(token: string): { id: string; email: string; role: UserRole; name: string } | null {
  try {
    const [data, signature] = token.split('.');
    if (!data || !signature) return null;

    const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(data).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      name: payload.name,
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  return {
    id: session.id,
    email: session.email,
    role: session.role,
    name: session.name,
    created_at: new Date().toISOString(),
  };
}

export async function setAuthCookie(user: { id: string; email: string; role: UserRole; name: string }) {
  const token = createSessionToken(user);
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

// Demo users seed helper
export const DEMO_USERS = [
  {
    email: 'doctor@docmate.ai',
    name: 'Dr. Farhana Rahman (MBBS, FCPS)',
    role: 'doctor' as UserRole,
    password: 'demo123',
  },
  {
    email: 'student@docmate.ai',
    name: 'Tanvir Ahmed (5th Year Trainee)',
    role: 'student' as UserRole,
    password: 'demo123',
  },
  {
    email: 'researcher@docmate.ai',
    name: 'Dr. Shamim Hossain (MPhil Clinical Epidemiology)',
    role: 'researcher' as UserRole,
    password: 'demo123',
  },
  {
    email: 'admin@docmate.ai',
    name: 'Admin User',
    role: 'admin' as UserRole,
    password: 'demo123',
  },
];

export async function seedDemoUsers() {
  for (const demo of DEMO_USERS) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, demo.email),
    });
    if (!existing) {
      await db.insert(users).values({
        email: demo.email,
        name: demo.name,
        role: demo.role,
        passwordHash: hashPassword(demo.password),
      });
    }
  }
}
