import { NextResponse } from 'next/server';
import { db } from '@/db';
import { prescriptions, prescriptionItems, patients, encounters, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { assertPatientDataScope } from '@/lib/permissions';
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

    const { id: rxId } = await params;

    const [rx] = await db.select().from(prescriptions).where(eq(prescriptions.id, rxId)).limit(1);
    if (!rx) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    const [patient] = await db.select().from(patients).where(eq(patients.id, rx.patientId)).limit(1);
    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Check data-scope
    const scopeCheck = await assertPatientDataScope({
      user,
      caseDoctorId: rx.doctorId,
      patientId: rx.patientId,
    });
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: `Access denied: ${scopeCheck.reason}` }, { status: 403 });
    }

    const [doctor] = await db.select().from(users).where(eq(users.id, rx.doctorId)).limit(1);

    let encounter = null;
    if (rx.encounterId) {
      [encounter] = await db.select().from(encounters).where(eq(encounters.id, rx.encounterId)).limit(1);
    }

    const items = await db.query.prescriptionItems.findMany({
      where: eq(prescriptionItems.prescriptionId, rx.id),
      orderBy: [prescriptionItems.createdAt],
    });

    return NextResponse.json({
      prescription: {
        id: rx.id,
        rx_number: rx.rxNumber,
        status: rx.status,
        diagnosis: rx.diagnosis,
        investigations: rx.investigations,
        general_advice: rx.generalAdvice,
        follow_up_text: rx.followUpText,
        qr_hash: rx.qrHash,
        finalized_at: rx.finalizedAt,
        created_at: rx.createdAt,
        patient: {
          id: patient.id,
          patient_code: patient.patientCode,
          name: decryptPatientPii(patient.nameEncrypted),
          phone: decryptPatientPii(patient.phoneEncrypted),
          age: patient.age,
          gender: patient.gender,
          blood_group: patient.bloodGroup,
        },
        doctor: doctor
          ? {
              id: doctor.id,
              name: doctor.name,
              bmdc_number: doctor.bmdcNumber || 'A-12345',
              degrees: 'MBBS, FCPS (Medicine)',
              hospital: 'Dhaka Medical College Hospital',
              chamber: 'Room 402, Specialized Outpatient Complex',
              phone: doctor.phone || '+8801700000000',
            }
          : null,
        encounter: encounter
          ? {
              chief_complaint: encounter.chiefComplaint,
              symptoms: encounter.symptoms,
              vitals: encounter.vitals,
              allergies: encounter.allergies,
            }
          : null,
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
      },
    });
  } catch (err) {
    console.error('Error fetching prescription details:', err);
    return NextResponse.json({ error: 'Failed to fetch prescription details' }, { status: 500 });
  }
}
