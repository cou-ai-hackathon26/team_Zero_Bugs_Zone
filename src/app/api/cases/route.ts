import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cases, auditLogs } from '@/db/schema';
import { desc, eq, ilike, or } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const all = await db.query.cases.findMany({
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch cases';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'doctor' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Only physicians and administrators are authorized to initiate clinical intake.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const { patient_code, structured_input } = body;

    if (!patient_code || !structured_input) {
      return NextResponse.json(
        { error: 'Patient code and structured input are required' },
        { status: 400 }
      );
    }

    const inserted = await db
      .insert(cases)
      .values({
        doctorId: user?.id || null,
        patientCode: patient_code,
        status: 'draft',
        structuredInput: structured_input,
      })
      .returning();

    const newCase = inserted[0];

    // Log audit event
    await db.insert(auditLogs).values({
      caseId: newCase.id,
      userId: user?.id || null,
      event: 'case_created',
      payload: {
        patient_code: newCase.patientCode,
        chief_complaint: structured_input.chief_complaint,
      },
    });

    return NextResponse.json({ case: newCase });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create case';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
