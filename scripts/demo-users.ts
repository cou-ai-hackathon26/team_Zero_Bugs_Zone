import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword } from '@/lib/auth';
import { eq } from 'drizzle-orm';
import type { UserRole } from '@/types';

// Demo users seed helper
const DEMO_USERS = [
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
  let doctorId: string | undefined;
  for (const demo of DEMO_USERS) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, demo.email),
    });
    let id = existing?.id;
    if (!existing) {
      const [created] = await db.insert(users).values({
        email: demo.email,
        name: demo.name,
        role: demo.role,
        passwordHash: await hashPassword(demo.password),
      }).returning({ id: users.id });
      id = created.id;
    } else if (/^[a-f0-9]{64}$/.test(existing.passwordHash) && existing.role === demo.role) {
      await db.update(users).set({ passwordHash: await hashPassword(demo.password) }).where(eq(users.id, existing.id));
    }
    if (demo.role === 'doctor' && (!existing || existing.role === 'doctor')) doctorId = id;
  }
  if (!doctorId) throw new Error('Cannot assign fixtures to a demo physician.');
  return doctorId;
}
