import { boundedJson, rateLimit } from '@/lib/api-input';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, setAuthCookie, verifyPassword } from '@/lib/auth';
import { UserRole } from '@/types';

export async function POST(request: Request) {
  try {
    const globalLimit = rateLimit('login', 60);
    if (globalLimit) return globalLimit;
    const input = z.object({
      email: z.string().trim().toLowerCase().pipe(z.email().max(255)),
      password: z.string().min(1).max(256),
    }).safeParse(await boundedJson(request, 2048));
    if (!input.success) return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 });
    const { email, password } = input.data;
    const accountLimit = rateLimit(`login:${email}`, 10);
    if (accountLimit) return accountLimit;
    if (/^(doctor|student|researcher|admin)@docmate\.ai$/.test(email) && process.env.DOCMATE_DEMO_MODE !== 'true') {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
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
