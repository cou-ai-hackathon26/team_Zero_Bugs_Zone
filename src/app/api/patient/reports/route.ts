import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientReports, patients } from '@/db/schema';
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
      return NextResponse.json({ reports: [] });
    }
    const patientId = allPatients[0].id;

    const reports = await db
      .select()
      .from(patientReports)
      .where(eq(patientReports.patientId, patientId))
      .orderBy(desc(patientReports.uploadedAt));

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Patient reports fetch error:', error);
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
    const { title, reportType, fileName, notes } = body;

    if (!title) {
      return NextResponse.json({ error: 'রিপোর্টের শিরোনাম আবশ্যক' }, { status: 400 });
    }

    const [newReport] = await db
      .insert(patientReports)
      .values({
        patientId,
        title,
        reportType: reportType || 'lab_test',
        fileUrl: `/uploads/reports/${fileName || 'report.pdf'}`,
        fileName: fileName || 'Uploaded_Document.pdf',
        notes: notes || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'রিপোর্ট সফলভাবে আপলোড হয়েছে',
      report: newReport,
    });
  } catch (error) {
    console.error('Patient report upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
