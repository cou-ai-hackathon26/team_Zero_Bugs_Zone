import { NextResponse } from 'next/server';
import { db } from '@/db';
import { chunks } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('source_id');

    if (!sourceId) {
      const allChunks = await db.query.chunks.findMany({
        limit: 50,
        orderBy: [desc(chunks.createdAt)],
      });
      return NextResponse.json({ chunks: allChunks });
    }

    const sourceChunks = await db.query.chunks.findMany({
      where: eq(chunks.sourceId, sourceId),
      orderBy: [chunks.page],
    });

    return NextResponse.json({ chunks: sourceChunks });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch chunks';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
