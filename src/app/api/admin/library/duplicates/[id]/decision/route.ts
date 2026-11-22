import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { pool } from '@/db';
import { recordAuditLog } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireFeaturePermission('library.review');
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: duplicateId } = await params;

  try {
    const body = await request.json();
    const { decision, reason } = body;

    if (!['skip', 'new_version', 'keep_both'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision. Must be skip, new_version, or keep_both' }, { status: 400 });
    }

    const { rowCount } = await pool.query(
      `UPDATE duplicate_candidates
       SET decision = $1, reason = $2, decided_by = $3, decided_at = NOW()
       WHERE id = $4;`,
      [decision, reason || null, auth.user.id, duplicateId]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: 'Duplicate candidate not found' }, { status: 404 });
    }

    await recordAuditLog({
      userId: auth.user.id,
      event: 'LIBRARY_DUPLICATE_DECISION',
      payload: { duplicateId, decision, reason, userEmail: auth.user.email },
    });

    return NextResponse.json({ success: true, message: `Duplicate resolution recorded: ${decision}` });
  } catch (error) {
    console.error('[admin/library/duplicates/decision] Error:', error);
    return NextResponse.json({ error: 'Failed to record duplicate decision' }, { status: 500 });
  }
}
