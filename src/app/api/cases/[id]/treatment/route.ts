import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ownedCase, requirePhysician, validCaseId } from '@/lib/case-access';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePhysician();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const caseRecord = validCaseId(id) && await db.query.cases.findFirst({
    columns: { id: true },
    where: ownedCase(id, user.id),
  });
  if (!caseRecord) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  return NextResponse.json({ status: 'insufficient_evidence' }, { status: 409 });
}
