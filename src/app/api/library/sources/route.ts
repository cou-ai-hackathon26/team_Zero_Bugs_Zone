import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sources, chunks } from '@/db/schema';
import { desc, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const list = await db.query.sources.findMany({
      orderBy: [desc(sources.createdAt)],
    });

    const chunkCounts = await db
      .select({
        sourceId: chunks.sourceId,
        count: sql<number>`count(*)::int`,
      })
      .from(chunks)
      .groupBy(chunks.sourceId);

    const countMap = new Map(chunkCounts.map((c) => [c.sourceId, c.count]));

    const enriched = list.map((s) => ({
      ...s,
      chunk_count: countMap.get(s.id) || 0,
    }));

    return NextResponse.json({ sources: enriched });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch sources';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin role required' }, { status: 403 });
    }

    const { title, type, year, license, url } = await request.json();

    if (!title || !type || !year) {
      return NextResponse.json({ error: 'Title, type, and publication year required' }, { status: 400 });
    }

    const inserted = await db
      .insert(sources)
      .values({
        title,
        type,
        year: parseInt(year, 10),
        license: license || 'Open Access / Academic Demo',
        url: url || null,
        status: 'active',
      })
      .returning();

    return NextResponse.json({ source: inserted[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to add source';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
