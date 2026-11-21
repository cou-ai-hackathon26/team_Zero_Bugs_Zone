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
    const body = await request.json();

    const { question_id, question, answer, note } = body;

    const caseRecord = await db.query.cases.findFirst({
      where: ownedCase(id, user.id),
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Insert turn
    const turn = await db
      .insert(caseTurns)
      .values({
        caseId: id,
        role: 'doctor',
        content: {
          type: question_id ? 'question_answer' : 'doctor_note',
          question_id,
          question,
          answer,
          note,
        },
      })
      .returning();

    // Append to structured input
    const input = caseRecord.structuredInput as Record<string, unknown>;
    const followUps = Array.isArray(input.follow_up_answers)
      ? (input.follow_up_answers as Array<{ question: string; answer: string }>)
      : [];

    if (question && answer) {
      followUps.push({ question, answer });
    }

    await db
      .update(cases)
      .set({
        structuredInput: {
          ...input,
          follow_up_answers: followUps,
        },
        updatedAt: new Date(),
      })
      .where(ownedCase(id, user.id));

    // Audit log
    await db.insert(auditLogs).values({
      caseId: id,
      userId: user.id,
      event: 'follow_up_answered',
      payload: { question_id, question, answer },
    });

    return NextResponse.json({ success: true, turn: turn[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to save turn';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
