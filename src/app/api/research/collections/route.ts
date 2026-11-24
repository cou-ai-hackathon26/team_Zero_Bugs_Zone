import { NextResponse } from 'next/server';
import { db } from '@/db';
import { researcherCollections } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const collections = await db
      .select()
      .from(researcherCollections)
      .where(eq(researcherCollections.userId, user.id))
      .orderBy(desc(researcherCollections.createdAt));

    return NextResponse.json({ collections });
  } catch (error) {
    console.error('Research collections fetch error:', error);
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
    const { title, description, items, tags } = body;

    if (!title) {
      return NextResponse.json({ error: 'শিরোনাম আবশ্যক' }, { status: 400 });
    }

    const [newCol] = await db
      .insert(researcherCollections)
      .values({
        userId: user.id,
        title,
        description: description || null,
        items: Array.isArray(items) ? items : [],
        tags: Array.isArray(tags) ? tags : [],
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'গবেষণা সংকলন তৈরি হয়েছে',
      collection: newCol,
    });
  } catch (error) {
    console.error('Research collection create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
