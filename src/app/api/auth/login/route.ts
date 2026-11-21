import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, setAuthCookie, verifyPassword } from '@/lib/auth';
import { UserRole } from '@/types';

export async function POST(request: Request) {
  try {
    const input = z.object({
      email: z.email().max(255),
      password: z.string().min(1).max(256),
    }).safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    const { email, password } = input.data;
    if (email.toLowerCase().endsWith('@docmate.ai') && process.env.DOCMATE_DEMO_MODE !== 'true') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    });

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!await verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (!user.passwordHash.startsWith('scrypt:')) {
      await db.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, user.id));
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      name: user.name,
    };

    await setAuthCookie(safeUser);

    return NextResponse.json({ user: safeUser });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
