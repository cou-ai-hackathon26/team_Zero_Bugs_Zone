import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, cases } from '@/db/schema';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const caseRecord = await db.query.cases.findFirst({
      where: ownedCase(id, user.id),
    });
    if (!caseRecord) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    let body: {
      approved_drugs?: string[];
      doctor_notes?: string;
      signature?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      // empty body
    }

    const signature = (body.signature || '').trim();
    if (!signature) {
      return NextResponse.json({ error: 'Doctor signature is required to finalize' }, { status: 400 });
    }

    const approvedDrugs = body.approved_drugs || [];

    // 1. Update case status to 'treated'
    const [updatedCase] = await db
      .update(cases)
      .set({
        status: 'treated',
        updatedAt: new Date(),
      })
      .where(ownedCase(id, user.id))
      .returning();

    // 2. Log prescription finalization in audit trail
    await db.insert(auditLogs).values({
      caseId: id,
      userId: user.id,
      event: 'prescription_finalized',
      payload: {
        confirmed_diagnosis: caseRecord.confirmedDiagnosis,
        approved_drugs: approvedDrugs,
        doctor_notes: body.doctor_notes || '',
        signature,
        finalized_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      status: 'finalized',
      case: updatedCase,
    });
  } catch (error) {
    console.error('[finalize error]', error);
    return NextResponse.json({ error: 'Failed to finalize prescription' }, { status: 500 });
  }
}
