import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { sourceVersioningService } from '@/lib/ingestion/versioning';
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

  const { id: sourceId } = await params;

  try {
    const body = await request.json();
    const { action, versionId, note } = body;

    if (action === 'approve_and_publish') {
      let targetVersionId = versionId;
      if (!targetVersionId) {
        const vRes = await pool.query(
          `SELECT id FROM source_versions WHERE source_id = $1 ORDER BY version_no DESC LIMIT 1;`,
          [sourceId]
        );
        if (vRes.rows.length === 0) {
          return NextResponse.json({ error: 'No version exists for this source' }, { status: 400 });
        }
        targetVersionId = vRes.rows[0].id;
      }

      await sourceVersioningService.publishVersion(sourceId, targetVersionId, auth.user.id);

      await recordAuditLog({
        userId: auth.user.id,
        event: 'LIBRARY_SOURCE_PUBLISHED',
        payload: { sourceId, versionId: targetVersionId, publishedBy: auth.user.email },
      });

      return NextResponse.json({
        success: true,
        message: 'Source approved and published. Chunks are now active and searchable.',
        messageBn: 'রিসোর্সটি অনুমোদিত এবং প্রকাশিত হয়েছে। এটি এখন সক্রিয় এবং অনুসন্ধানে পাওয়া যাবে।',
      });
    } else if (action === 'request_changes') {
      await pool.query(
        `UPDATE sources SET lifecycle = 'draft', updated_at = NOW() WHERE id = $1;`,
        [sourceId]
      );

      await recordAuditLog({
        userId: auth.user.id,
        event: 'LIBRARY_REVIEW_CHANGES_REQUESTED',
        payload: { sourceId, note, reviewer: auth.user.email },
      });

      return NextResponse.json({
        success: true,
        message: 'Source moved back to draft. Changes requested.',
        messageBn: 'রিসোর্সটি ড্রাফট অবস্থায় ফেরত পাঠানো হয়েছে।',
      });
    } else if (action === 'reject') {
      await sourceVersioningService.retireSource(sourceId, auth.user.id, note || 'Rejected during review');

      await recordAuditLog({
        userId: auth.user.id,
        event: 'LIBRARY_REVIEW_REJECTED',
        payload: { sourceId, note, reviewer: auth.user.email },
      });

      return NextResponse.json({
        success: true,
        message: 'Source rejected and archived.',
        messageBn: 'রিসোর্সটি বাতিল ও আর্কাইভ করা হয়েছে।',
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (error) {
    console.error('[admin/library/sources/[id]/review] Error:', error);
    return NextResponse.json({ error: 'Review action failed' }, { status: 500 });
  }
}
