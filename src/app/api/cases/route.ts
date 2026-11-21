import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { caseInput } from '@/lib/case-input';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cases, auditLogs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { requirePhysician } from '@/lib/case-access';
import { withIdempotency } from '@/lib/idempotency';

export async function GET(request: Request) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    if (!z.object({ status: z.string().max(30).nullable(), search: z.string().max(250).nullable() }).safeParse({ status, search }).success) {
      return NextResponse.json({ error: 'Invalid case filters' }, { status: 400 });
    }

    const all = await db.query.cases.findMany({
      where: eq(cases.doctorId, user.id),
      orderBy: [desc(cases.updatedAt)],
    });

    let filtered = all;
    if (status && status !== 'all') {
      filtered = filtered.filter((c) => c.status === status);
    }
    if (search && search.trim().length > 0) {
      const q = search.toLowerCase();
      filtered = filtered.filter((c) => {
        const pCode = c.patientCode.toLowerCase();
        const input = c.structuredInput as Record<string, unknown>;
        const complaint = String(input.chief_complaint || '').toLowerCase();
        const dx = String(c.confirmedDiagnosis || '').toLowerCase();
        return pCode.includes(q) || complaint.includes(q) || dx.includes(q);
      });
    }

    const mapped = filtered.map((c) => ({
      ...c,
      patient_code: c.patientCode,
      structured_input: c.structuredInput,
      confirmed_diagnosis: c.confirmedDiagnosis,
      doctor_id: c.doctorId,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
    }));

    return NextResponse.json({ cases: mapped });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch cases' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;

    const input = caseInput.safeParse(await boundedJson(request));
    if (!input.success) return NextResponse.json({ error: 'Invalid synthetic case input' }, { status: 400 });
    const { patient_code, structured_input, profile_id, idempotency_key } = input.data;

    return await withIdempotency(idempotency_key, '/api/cases', async () => {
      const newCase = await db.transaction(async (tx) => {
        const [record] = await tx.insert(cases).values({
          doctorId: user.id,
          profileId: profile_id || null,
          patientCode: patient_code,
          status: 'draft',
          structuredInput: structured_input,
        }).returning();
        await tx.insert(auditLogs).values({
          caseId: record.id,
          userId: user.id,
          event: 'case_created',
          payload: { profileId: profile_id || null },
        });
        return record;
      });

      return NextResponse.json({ case: newCase });
    });
  } catch {
    return NextResponse.json({ error: 'Failed to create case' }, { status: 500 });
  }
}
