import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patients, encounters, prescriptions, prescriptionItems } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { assertPatientDataScope, canUse } from '@/lib/permissions';
import { decryptPatientPii } from '@/lib/encryption';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: patientId } = await params;

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId))
      .limit(1);

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Verify feature access
    const featureCheck = await canUse(user, 'patients.manage');
    if (!featureCheck.allowed && user.role !== 'patient' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Access denied: patients.manage required' }, { status: 403 });
    }

    // Assert data-scope policy
    const scopeCheck = await assertPatientDataScope({
      user,
      caseDoctorId: patient.doctorId,
      patientId: patient.id,
    });

    if (!scopeCheck.allowed) {
      return NextResponse.json(
        { error: `Data-scope boundary violation: ${scopeCheck.reason}` },
        { status: 403 }
      );
    }

    // Fetch encounters
    const patientEncounters = await db.query.encounters.findMany({
      where: eq(encounters.patientId, patientId),
      orderBy: [desc(encounters.visitDate)],
    });

    // Fetch prescriptions with items
    const patientPrescriptions = await db.query.prescriptions.findMany({
      where: eq(prescriptions.patientId, patientId),
      orderBy: [desc(prescriptions.createdAt)],
    });

    const prescriptionsWithItems = await Promise.all(
      patientPrescriptions.map(async (rx) => {
        const items = await db.query.prescriptionItems.findMany({
          where: eq(prescriptionItems.prescriptionId, rx.id),
        });
        return {
          ...rx,
          rx_number: rx.rxNumber,
          investigations: rx.investigations,
          general_advice: rx.generalAdvice,
          follow_up_text: rx.followUpText,
          qr_hash: rx.qrHash,
          finalized_at: rx.finalizedAt,
          items: items.map((it) => ({
            id: it.id,
            brand_name: it.brandName,
            generic_name: it.genericName,
            strength: it.strength,
            form: it.form,
            dosing_schedule: it.dosingSchedule,
            meal_timing: it.mealTiming,
            duration_days: it.durationDays,
            duration_text: it.durationText,
            instructions: it.instructions,
          })),
        };
      })
    );

    return NextResponse.json({
      patient: {
        id: patient.id,
        patient_code: patient.patientCode,
        name: decryptPatientPii(patient.nameEncrypted),
        phone: decryptPatientPii(patient.phoneEncrypted),
        age: patient.age,
        gender: patient.gender,
        blood_group: patient.bloodGroup,
        emergency_contact: patient.emergencyContact,
        consent_obtained: patient.consentObtained,
        consent_obtained_at: patient.consentObtainedAt,
        created_at: patient.createdAt,
      },
      encounters: patientEncounters,
      prescriptions: prescriptionsWithItems,
    });
  } catch (err) {
    console.error('Error fetching patient profile:', err);
    return NextResponse.json({ error: 'Failed to fetch patient profile' }, { status: 500 });
  }
}
