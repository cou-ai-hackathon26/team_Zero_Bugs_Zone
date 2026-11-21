import { NextResponse } from 'next/server';
import { db } from '@/db';
import { prescriptions, prescriptionItems, patients, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // In demo environment, resolve first patient
    const allPatients = await db.select().from(patients).limit(1);
    if (allPatients.length === 0) {
      return NextResponse.json({ prescriptions: [] });
    }
    const patientId = allPatients[0].id;

    // Fetch finalized or shared prescriptions
    const rxList = await db
      .select({
        id: prescriptions.id,
        rxNumber: prescriptions.rxNumber,
        diagnosis: prescriptions.diagnosis,
        investigations: prescriptions.investigations,
        generalAdvice: prescriptions.generalAdvice,
        followUpText: prescriptions.followUpText,
        status: prescriptions.status,
        qrHash: prescriptions.qrHash,
        finalizedAt: prescriptions.finalizedAt,
        doctorName: users.name,
        doctorBmdc: users.bmdcNumber,
      })
      .from(prescriptions)
      .leftJoin(users, eq(prescriptions.doctorId, users.id))
      .where(eq(prescriptions.patientId, patientId))
      .orderBy(desc(prescriptions.createdAt));

    // Fetch items for each prescription
    const fullPrescriptions = await Promise.all(
      rxList.map(async (rx) => {
        const items = await db
          .select()
          .from(prescriptionItems)
          .where(eq(prescriptionItems.prescriptionId, rx.id))
          .orderBy(prescriptionItems.createdAt);
        return {
          ...rx,
          items,
        };
      })
    );

    return NextResponse.json({ prescriptions: fullPrescriptions });
  } catch (error) {
    console.error('Patient prescriptions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
