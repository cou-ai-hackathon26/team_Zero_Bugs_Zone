import { abstentionModel } from '@/lib/analysis-policy';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cases, analyses, caseTurns } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const caseRecord = await db.query.cases.findFirst({
      where: ownedCase(id, user.id),
    });

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Get latest analysis
    const latestAnalysis = await db.query.analyses.findFirst({
      where: and(eq(analyses.caseId, id), eq(analyses.model, abstentionModel)),
      orderBy: [desc(analyses.round)],
    });

    // Get all analyses for this case (history)
    const allAnalyses = await db.query.analyses.findMany({
      where: and(eq(analyses.caseId, id), eq(analyses.model, abstentionModel)),
      orderBy: [desc(analyses.round)],
    });

    // Get turns (Q&A history)
    const turns = await db.query.caseTurns.findMany({
      where: eq(caseTurns.caseId, id),
      orderBy: [caseTurns.createdAt],
    });

    const formattedCase = {
      ...caseRecord,
      patient_code: caseRecord.patientCode,
      structured_input: caseRecord.structuredInput,
      confirmed_diagnosis: caseRecord.confirmedDiagnosis,
      doctor_id: caseRecord.doctorId,
      created_at: caseRecord.createdAt,
      updated_at: caseRecord.updatedAt,
    };

    return NextResponse.json({
      case: formattedCase,
      analysis: latestAnalysis ? latestAnalysis.output : null,
      analysisRecord: latestAnalysis,
      analyses: allAnalyses,
      turns,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch case';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const body = await request.json();

    const { status, confirmedDiagnosis } = body;

    const updated = await db
      .update(cases)
      .set({
        ...(status && { status }),
        ...(confirmedDiagnosis && { confirmedDiagnosis }),
        updatedAt: new Date(),
      })
      .where(ownedCase(id, user.id))
      .returning();

    if (!updated[0]) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    return NextResponse.json({ case: updated[0] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update case';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
