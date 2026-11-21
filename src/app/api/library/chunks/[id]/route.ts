import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chunks, sources } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch chunk';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
