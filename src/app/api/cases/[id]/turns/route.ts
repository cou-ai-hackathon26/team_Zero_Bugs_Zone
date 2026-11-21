import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { caseTurns, cases, auditLogs } from '@/db/schema';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const schema = z.union([
      z.object({
        question_id: z.string().min(1).max(100), question: z.string().min(1).max(1000),
        answer: z.string().trim().min(1).max(4000),
      }),
      z.object({ note: z.string().trim().min(1).max(4000) }),
    ]);
    const input = schema.safeParse(await boundedJson(request));
    if (!input.success) return NextResponse.json({ error: 'Invalid clinical observation' }, { status: 400 });
    const followUp = 'question_id' in input.data;

    const turn = await db.transaction(async (tx) => {
      const [record] = await tx.select().from(cases).where(ownedCase(id, user.id)).for('update');
      if (!record) return null;
      const [created] = await tx.insert(caseTurns).values({
        caseId: id, role: 'doctor',
        content: { type: followUp ? 'question_answer' : 'doctor_note', ...input.data },
      }).returning();
      await tx.update(cases).set({ updatedAt: new Date() }).where(ownedCase(id, user.id));
      await tx.insert(auditLogs).values({
        caseId: id, userId: user.id, event: followUp ? 'follow_up_answered' : 'case_note_added',
        payload: 'question_id' in input.data ? { question_id: input.data.question_id } : {},
      });
      return created;
    });
    if (!turn) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    return NextResponse.json({ success: true, turn });
  } catch {
    return NextResponse.json({ error: 'Failed to save turn' }, { status: 500 });
  }
}
