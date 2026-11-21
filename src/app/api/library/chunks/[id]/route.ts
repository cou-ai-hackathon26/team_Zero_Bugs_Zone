import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chunks, sources } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await getCurrentUser()) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const { id } = await params;
    if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid chunk ID' }, { status: 400 });
    const chunkRecord = await db.query.chunks.findFirst({
      where: eq(chunks.id, id),
    });

    if (!chunkRecord) {
      return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
    }

    const sourceRecord = await db.query.sources.findFirst({
      where: eq(sources.id, chunkRecord.sourceId),
    });

    return NextResponse.json({
      chunk: {
        ...chunkRecord,
        source_title: sourceRecord?.title,
        source_year: sourceRecord?.year,
        source_license: sourceRecord?.license,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch chunk' }, { status: 500 });
  }
}
