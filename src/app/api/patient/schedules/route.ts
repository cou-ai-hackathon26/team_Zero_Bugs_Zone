import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientSchedules, patients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve patient record (for demo or linked user)
    const allPatients = await db.select().from(patients).limit(1);
    if (allPatients.length === 0) {
      return NextResponse.json({ schedules: [] });
    }
    const patientId = allPatients[0].id;

    const schedules = await db
      .select()
      .from(patientSchedules)
      .where(eq(patientSchedules.patientId, patientId))
      .orderBy(patientSchedules.createdAt);

    return NextResponse.json({
      patient: {
        code: allPatients[0].patientCode,
        gender: allPatients[0].gender,
        age: allPatients[0].age,
        bloodGroup: allPatients[0].bloodGroup,
        consentObtained: allPatients[0].consentObtained,
      },
      schedules,
    });
  } catch (error) {
    console.error('Patient schedule fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { scheduleId, takenToday } = body;

    if (!scheduleId) {
      return NextResponse.json({ error: 'scheduleId is required' }, { status: 400 });
    }

    await db
      .update(patientSchedules)
      .set({
        takenToday: Boolean(takenToday),
        lastTakenAt: takenToday ? new Date() : null,
      })
      .where(eq(patientSchedules.id, scheduleId));

    return NextResponse.json({
      success: true,
      message: takenToday ? 'ওষুধ গ্রহণের রেকর্ড সংরক্ষিত হয়েছে' : 'স্ট্যাটাস আপডেট হয়েছে',
    });
  } catch (error) {
    console.error('Patient schedule update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
