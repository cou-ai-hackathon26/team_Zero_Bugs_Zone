import { NextResponse } from 'next/server';
import { db, pool } from '@/db';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';
import { generate21SectionClinicalReport } from '@/lib/clinical/report-generator';
import type { DrugRecord, DrugInteractionRecord, StructuredPatientInput } from '@/types';

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
    if (!caseRecord) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const url = new URL(request.url);
    const locale = (url.searchParams.get('locale') || 'bn') as 'bn' | 'en';

    // Fetch drugs and interactions for safety checks
    const [drugsRes, interactionsRes] = await Promise.all([
      pool.query<DrugRecord>('SELECT * FROM drugs ORDER BY generic_name ASC'),
      pool.query<DrugInteractionRecord>('SELECT * FROM drug_interactions'),
    ]);

    const formattedCase = {
      id: caseRecord.id,
      doctor_id: caseRecord.doctorId || '',
      patient_code: caseRecord.patientCode,
      status: caseRecord.status as any,
      structured_input: caseRecord.structuredInput as StructuredPatientInput,
      confirmed_diagnosis: caseRecord.confirmedDiagnosis || undefined,
      created_at: caseRecord.createdAt ? caseRecord.createdAt.toISOString() : new Date().toISOString(),
      updated_at: caseRecord.updatedAt ? caseRecord.updatedAt.toISOString() : new Date().toISOString(),
    };

    const report = generate21SectionClinicalReport({
      caseData: formattedCase,
      locale,
      drugsDb: drugsRes.rows,
      interactionsDb: interactionsRes.rows,
    });

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('[report generator error]', error);
    return NextResponse.json({ error: 'Failed to generate clinical report' }, { status: 500 });
  }
}
