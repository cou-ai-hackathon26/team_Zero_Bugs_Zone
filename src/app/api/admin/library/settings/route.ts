import { NextRequest, NextResponse } from 'next/server';
import { requireFeaturePermission } from '@/lib/permissions';
import { pool } from '@/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET() {
  const auth = await requireFeaturePermission('library.manage');
  if (auth.error) {
    const ingestAuth = await requireFeaturePermission('library.ingest');
    if (ingestAuth.error) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
  }

  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM system_settings WHERE key LIKE 'ingest%' OR key LIKE 'ingestion%';`
    );

    const settingsMap: Record<string, string> = {
      'ingestion.daily_budget_usd': '10.00',
      'ingestion.approval_threshold_usd': '2.00',
      'ingest.ocr_enabled': 'false',
    };

    for (const r of rows) {
      settingsMap[r.key] = r.value;
    }

    return NextResponse.json({ settings: settingsMap });
  } catch (error) {
    console.error('[admin/library/settings] Failed to fetch settings:', error);
    return NextResponse.json({ error: 'Failed to retrieve settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFeaturePermission('library.manage');
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { settings } = body;

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 });
    }

    for (const [key, val] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value, updated_at = NOW();`,
        [key, String(val)]
      );
    }

    await recordAuditLog({
      userId: auth.user.id,
      event: 'SYSTEM_SETTINGS_UPDATED',
      payload: { updatedKeys: Object.keys(settings), updatedBy: auth.user.email },
    });

    return NextResponse.json({ success: true, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('[admin/library/settings] Failed to save settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
