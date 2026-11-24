import { NextResponse } from 'next/server';
import { db } from '@/db';
import { medicineNotices } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const notices = await db
      .select({
        id: medicineNotices.id,
        title: medicineNotices.title,
        severity: medicineNotices.severity,
        body: medicineNotices.body,
        affectedBatches: medicineNotices.affectedBatches,
        publishedAt: medicineNotices.publishedAt,
      })
      .from(medicineNotices)
      .orderBy(desc(medicineNotices.publishedAt))
      .limit(10);

    return NextResponse.json({ notices });
  } catch (error) {
    console.error('[medicines/notices/active] error:', error);
    return NextResponse.json({ error: 'Failed to fetch notices' }, { status: 500 });
  }
}
