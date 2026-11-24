import { NextResponse } from 'next/server';
import { db } from '@/db';
import { studentNotes, chunks, sources } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const notes = await db
      .select({
        id: studentNotes.id,
        title: studentNotes.title,
        content: studentNotes.content,
        tags: studentNotes.tags,
        createdAt: studentNotes.createdAt,
        updatedAt: studentNotes.updatedAt,
        chunkText: chunks.text,
        chunkSection: chunks.section,
        sourceTitle: sources.title,
      })
      .from(studentNotes)
      .leftJoin(chunks, eq(studentNotes.chunkId, chunks.id))
      .leftJoin(sources, eq(chunks.sourceId, sources.id))
      .where(eq(studentNotes.userId, user.id))
      .orderBy(desc(studentNotes.updatedAt));

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Student notes fetch error:', error);
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
    const { title, content, tags, chunkId } = body;

    if (!title || !content) {
      return NextResponse.json({ error: 'শিরোনাম ও বিষয়বস্তু আবশ্যক' }, { status: 400 });
    }

    const [newNote] = await db
      .insert(studentNotes)
      .values({
        userId: user.id,
        title,
        content,
        tags: Array.isArray(tags) ? tags : [],
        chunkId: chunkId || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'স্টাডি নোট সফলভাবে সংরক্ষিত হয়েছে',
      note: newNote,
    });
  } catch (error) {
    console.error('Student note save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
