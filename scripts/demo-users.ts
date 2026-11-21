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
  for (const demo of DEMO_USERS) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, demo.email),
    });
    if (!existing) {
      await db.insert(users).values({
        email: demo.email,
        name: demo.name,
        role: demo.role,
        passwordHash: await hashPassword(demo.password),
      });
    }
  }
}
