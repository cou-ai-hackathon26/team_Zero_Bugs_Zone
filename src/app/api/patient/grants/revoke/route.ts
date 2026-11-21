import { NextResponse } from 'next/server';
import { db } from '@/db';
import { accessGrants, patientConsentLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { recordAccessLog } from '@/lib/access-log';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { grantId, profileId } = body;

    if (!grantId || !profileId) {
      return NextResponse.json(
        { error: 'grantId and profileId are required' },
        { status: 400 }
      );
    }

    // Revoke the grant
    const [updated] = await db
      .update(accessGrants)
      .set({
        status: 'revoked',
        revokedAt: new Date(),
      })
      .where(eq(accessGrants.id, grantId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Grant record not found' }, { status: 404 });
    }

    // Record in patient_consent_logs
    await db.insert(patientConsentLogs).values({
      profileId,
      action: 'revoked',
      reason: 'Patient revoked access via Patient Portal',
    });

    // Record in access_logs
    await recordAccessLog({
      userId: user.id,
      profileId,
      userRole: 'patient',
      action: 'grant_revoked',
      recordType: 'access_grant',
      recordId: grantId,
      reason: 'Patient explicitly revoked clinical data sharing grant',
    });

    return NextResponse.json({
      success: true,
      message: 'অনুমতি সফলভাবে বাতিল করা হয়েছে (Access grant successfully revoked)',
    });
  } catch (error) {
    console.error('Revoke grant error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
