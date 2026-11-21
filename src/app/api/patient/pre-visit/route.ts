import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientPreVisits, patients } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allPatients = await db.select().from(patients).limit(1);
    if (allPatients.length === 0) {
      return NextResponse.json({ preVisits: [] });
    }
    const patientId = allPatients[0].id;

    const preVisits = await db
      .select()
      .from(patientPreVisits)
      .where(eq(patientPreVisits.patientId, patientId))
      .orderBy(desc(patientPreVisits.submittedAt));

    return NextResponse.json({ preVisits });
  } catch (error) {
    console.error('Patient pre-visit fetch error:', error);
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
    const patientId = allPatients[0].id;

    const body = await req.json();
    const { chiefComplaint, symptoms, duration, notes } = body;

    if (!chiefComplaint) {
      return NextResponse.json({ error: 'প্রধান সমস্যা / লক্ষণের বিবরণ আবশ্যক' }, { status: 400 });
    }

    const [record] = await db
      .insert(patientPreVisits)
      .values({
        patientId,
        chiefComplaint,
        symptoms: Array.isArray(symptoms) ? symptoms : [],
        duration: duration || '১-২ দিন',
        notes: notes || null,
        status: 'pending',
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'পূর্ব-ভিজিট তথ্য জমা হয়েছে। চিকিৎসক পরিদর্শনের সময় তা দেখতে পাবেন।',
      preVisit: record,
    });
  } catch (error) {
    console.error('Patient pre-visit submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
