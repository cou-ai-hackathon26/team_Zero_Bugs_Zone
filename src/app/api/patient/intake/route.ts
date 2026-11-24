import { NextResponse } from 'next/server';
import { db } from '@/db';
import { medicineIntakeLogs, patientSchedules } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { profileId, prescriptionItemId, scheduleId, slot } = body;

    if (!profileId) {
      return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
    }

    // Insert into medicine_intake_logs
    const [log] = await db
      .insert(medicineIntakeLogs)
      .values({
        profileId,
        prescriptionItemId: prescriptionItemId || null,
        slot: slot || 'morning',
        takenAt: new Date(),
      })
      .returning();

    // If scheduleId provided from patientSchedules, update it
    if (scheduleId && !scheduleId.startsWith('rx-')) {
      await db
        .update(patientSchedules)
        .set({
          takenToday: true,
          lastTakenAt: new Date(),
        })
        .where(eq(patientSchedules.id, scheduleId));
    }

    return NextResponse.json({
      success: true,
      message: 'ওষুধ গ্রহণের রেকর্ড সংরক্ষিত হয়েছে (Dose recorded as taken)',
      intakeId: log.id,
      takenAt: log.takenAt.toISOString(),
    });
  } catch (error) {
    console.error('Medicine intake logging error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
