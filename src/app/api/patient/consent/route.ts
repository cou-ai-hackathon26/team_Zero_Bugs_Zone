import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patients, patientConsentLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { recordAuditLog } from '@/lib/audit';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allPatients = await db.select().from(patients).limit(1);
    if (allPatients.length === 0) {
      return NextResponse.json({ consentObtained: false });
    }
    const patient = allPatients[0];

    const logs = await db
      .select()
      .from(patientConsentLogs)
      .where(eq(patientConsentLogs.patientId, patient.id))
      .orderBy(patientConsentLogs.loggedAt);

    return NextResponse.json({
      consentObtained: patient.consentObtained,
      consentObtainedAt: patient.consentObtainedAt,
      logs,
    });
  } catch (error) {
    console.error('Patient consent status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allPatients = await db.select().from(patients).limit(1);
    if (allPatients.length === 0) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }
    const patient = allPatients[0];

    const body = await req.json();
    const { action, reason } = body; // action: 'granted' | 'revoked'

    if (action !== 'granted' && action !== 'revoked') {
      return NextResponse.json({ error: 'Invalid action. Must be granted or revoked.' }, { status: 400 });
    }

    const nextConsent = action === 'granted';

    await db
      .update(patients)
      .set({
        consentObtained: nextConsent,
        consentObtainedAt: nextConsent ? new Date() : null,
      })
      .where(eq(patients.id, patient.id));

    await db.insert(patientConsentLogs).values({
      patientId: patient.id,
      action,
      reason: reason || (nextConsent ? 'Patient granted digital health data processing consent.' : 'Patient requested data sharing revocation.'),
    });

    await recordAuditLog({
      userId: user.id,
      event: action === 'granted' ? 'patient.consent_granted' : 'patient.consent_revoked',
      payload: { patientCode: patient.patientCode, action, reason },
    });

    return NextResponse.json({
      success: true,
      consentObtained: nextConsent,
      message: nextConsent
        ? 'স্বাস্থ্য তথ্য ব্যবহারের সম্মতি সক্রিয় করা হয়েছে'
        : 'স্বাস্থ্য তথ্য প্রক্রিয়াকরণ ও শেয়ারিং প্রত্যাহার করা হয়েছে',
    });
  } catch (error) {
    console.error('Patient consent update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
