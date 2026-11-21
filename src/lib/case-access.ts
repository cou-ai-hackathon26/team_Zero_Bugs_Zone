import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { cases } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';

export async function requirePhysician() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (user.role !== 'doctor' && user.role !== 'admin') {
    return NextResponse.json({ error: 'Physician or Administrator access required' }, { status: 403 });
  }
  return user;
}

export function ownedCase(id: string, doctorId: string, role?: string) {
  if (role === 'admin') {
    return eq(cases.id, id);
  }
  return and(eq(cases.id, id), eq(cases.doctorId, doctorId));
}

export function validCaseId(id: string) {
  return z.uuid().safeParse(id).success;
}
