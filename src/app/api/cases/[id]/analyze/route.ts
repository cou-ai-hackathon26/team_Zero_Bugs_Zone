import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { analyses, auditLogs, cases } from '@/db/schema';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import type { AnalysisOutput, StructuredPatientInput } from '@/types';
import bn from '../../../../../../messages/bn.json';
import en from '../../../../../../messages/en.json';

const inputSchema = z.object({ locale: z.enum(['bn', 'en']).default('bn') });
import { abstentionModel } from '@/lib/analysis-policy';

function abstain(patient: StructuredPatientInput, locale: 'bn' | 'en'): AnalysisOutput {
  const t = (locale === 'bn' ? bn : en).analysisGuard;
  const missing = { why_it_helps: '', which_diagnoses_it_separates: [] };
  return {
    status: 'insufficient_evidence',
    confidence: { label: 'insufficient', score: 0, reasoning: t.reason },
    differentials: [],
    missing_information: [
      ...(Object.keys(patient.vitals ?? {}).length === 0
        ? [{ ...missing, id: 'vitals', type: 'exam' as const, text: t.vitals }]
        : []),
      { ...missing, id: 'exam', type: 'question', text: t.exam },
    ],
    red_flags: [],
    summary: t.reason,
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePhysician();
    if (user instanceof NextResponse) return user;
    const { id } = await params;
    if (!validCaseId(id)) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    const input = inputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) return NextResponse.json({ error: 'Invalid analysis request' }, { status: 400 });

    const result = await db.transaction(async (tx) => {
      const [record] = await tx.select().from(cases).where(ownedCase(id, user.id)).for('update');
      if (!record) return null;

      const last = await tx.query.analyses.findFirst({
        columns: { round: true },
        where: eq(analyses.caseId, id),
        orderBy: [desc(analyses.round)],
      });
      const round = (last?.round ?? 0) + 1;
      const analysis = abstain(record.structuredInput as StructuredPatientInput, input.data.locale);
      await tx.insert(analyses).values({ caseId: id, round, output: analysis, model: abstentionModel, tokens: 0 });
      const [updated] = await tx.update(cases).set({
        status: 'insufficient_evidence',
        updatedAt: new Date(),
      }).where(ownedCase(id, user.id)).returning();
      await tx.insert(auditLogs).values({
        caseId: id, userId: user.id, event: 'case_analyzed', payload: { round, status: analysis.status },
      });

      return { case: { ...updated, patient_code: updated.patientCode, structured_input: updated.structuredInput }, round, analysis };
    });
    if (!result) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...result });
  } catch {
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 });
  }
}
