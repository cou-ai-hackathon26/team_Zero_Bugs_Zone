import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cases, auditLogs } from '@/db/schema';
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

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'doctor' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized: Prescriptions can only be legally finalized and signed by a licensed physician.' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const {
      approved_drugs,
      doctor_notes,
      unacknowledged_critical_alerts_count,
      signature,
    } = body;

    // Hard Rule: Critical alerts must be acknowledged before finalising
    if (unacknowledged_critical_alerts_count > 0) {
      return NextResponse.json(
        {
          error:
            'Critical safety alert must be acknowledged by the prescribing physician before prescription can be finalised.',
        },
        { status: 400 }
      );
    }

    const caseRecord = await db.query.cases.findFirst({
      where: ownedCase(id, user.id),
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    const input = caseRecord.structuredInput as Record<string, unknown>;

    const prescriptionSummary = {
      approved_drugs,
      doctor_notes: doctor_notes || '',
      signature: signature || user?.name || 'Authorized Physician',
      finalized_at: new Date().toISOString(),
      prescribing_doctor: user?.name || 'Dr. Farhana Rahman (MBBS, FCPS)',
    };

    await db
      .update(cases)
      .set({
        status: 'treated',
        structuredInput: {
          ...input,
          prescription: prescriptionSummary,
        },
        updatedAt: new Date(),
      })
      .where(ownedCase(id, user.id));

    // Audit log
    await db.insert(auditLogs).values({
      caseId: id,
      userId: user.id,
      event: 'prescription_finalized',
      payload: {
        drugs_count: approved_drugs?.length || 0,
        signature: prescriptionSummary.signature,
      },
    });

    return NextResponse.json({
      success: true,
      prescription: prescriptionSummary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to finalize prescription';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
