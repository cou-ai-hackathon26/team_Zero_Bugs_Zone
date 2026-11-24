import { NextResponse } from 'next/server';
import { db } from '@/db';
import { prescriptions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { canUse, assertPatientDataScope } from '@/lib/permissions';
import { createAuditLogEntry } from '@/lib/audit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const permission = await canUse(user, 'prescription.create');
    if (!permission.allowed) {
      return NextResponse.json(
        { error: `Access denied: prescription.create permission required (${permission.reason})` },
        { status: 403 }
      );
    }

    const { id: rxId } = await params;
    const [rx] = await db.select().from(prescriptions).where(eq(prescriptions.id, rxId)).limit(1);
    if (!rx) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    const scopeCheck = await assertPatientDataScope({
      user,
      caseDoctorId: rx.doctorId,
      patientId: rx.patientId,
    });
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: `Access denied: ${scopeCheck.reason}` }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { acknowledgedCriticalWarnings = false } = body;

    // Check if safety critical stop requires acknowledgment
    const [updatedRx] = await db
      .update(prescriptions)
      .set({
        status: 'finalized',
        finalizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(prescriptions.id, rx.id))
      .returning();

    await createAuditLogEntry({
      userId: user.id,
      event: 'PRESCRIPTION_FINALIZED',
      payload: {
        prescriptionId: updatedRx.id,
        rxNumber: updatedRx.rxNumber,
        patientId: updatedRx.patientId,
        acknowledgedCriticalWarnings,
        finalizedAt: updatedRx.finalizedAt,
      },
    });

    return NextResponse.json({
      success: true,
      prescription: {
        id: updatedRx.id,
        rx_number: updatedRx.rxNumber,
        status: updatedRx.status,
        finalized_at: updatedRx.finalizedAt,
        qr_hash: updatedRx.qrHash,
      },
    });
  } catch (err) {
    console.error('Error finalizing prescription:', err);
    return NextResponse.json({ error: 'Failed to finalize prescription' }, { status: 500 });
  }
}
