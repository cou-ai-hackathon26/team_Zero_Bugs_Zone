import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientReports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { reportId, isShared } = body;

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required' }, { status: 400 });
    }

    const [updated] = await db
      .update(patientReports)
      .set({ isShared: Boolean(isShared) })
      .where(eq(patientReports.id, reportId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      isShared: updated.isShared,
      message: updated.isShared
        ? 'রিপোর্টটি এখন ডাক্তারের সাথে শেয়ার করা হচ্ছে'
        : 'রিপোর্টটি ব্যক্তিগত (গোপনীয়) রাখা হয়েছে',
    });
  } catch (error) {
    console.error('Toggle report sharing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
