import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  patientAccounts,
  patientProfiles,
  accessGrants,
  accessLogs,
  prescriptions,
  encounters,
} from '@/db/schema';
import { eq, and, gt, or, count, gte, ne, isNull } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { canUse } from '@/lib/permissions';
import { normalizeBangladeshiPhone, maskPhoneNumber } from '@/lib/phone';
import { decryptPatientPii } from '@/lib/encryption';

const HOURLY_SEARCH_LIMIT = 30;

function maskProfileName(fullName: string): string {
  if (!fullName) return 'Patient';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    const first = parts[0];
    return first.length > 2 ? `${first.slice(0, 2)}***` : `${first}*`;
  }
  // Show first name + initial of second
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Only doctors or super_admin can search patients
    if (user.role !== 'doctor' && user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
    }

    // Check capability
    const permission = await canUse(user, 'patients.manage');
    if (!permission.allowed && user.role !== 'super_admin') {
      return NextResponse.json({ error: `Access denied: ${permission.reason}` }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const rawPhone = searchParams.get('phone')?.trim() || '';

    const norm = normalizeBangladeshiPhone(rawPhone);
    if (!norm.isValid) {
      return NextResponse.json(
        { error: norm.error || 'সঠিক ফোন নম্বর প্রদান করুন (Invalid phone number)' },
        { status: 400 }
      );
    }

    // Anti-enumeration rate limit: max 30 searches per hour per doctor
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [searchCountRow] = await db
      .select({ val: count() })
      .from(accessLogs)
      .where(
        and(
          eq(accessLogs.userId, user.id),
          eq(accessLogs.action, 'PHONE_SEARCH'),
          gte(accessLogs.createdAt, oneHourAgo)
        )
      );

    if (searchCountRow && searchCountRow.val >= HOURLY_SEARCH_LIMIT) {
      return NextResponse.json(
        {
          error:
            'অনুসন্ধান সীমা অতিক্রান্ত (Search rate limit exceeded: max 30 searches/hour for anti-enumeration)',
        },
        { status: 429 }
      );
    }

    // Lookup patient_account by normalized E.164 phone
    const [account] = await db
      .select({ id: patientAccounts.id, phone: patientAccounts.phone })
      .from(patientAccounts)
      .where(
        or(
          eq(patientAccounts.phone, norm.e164),
          eq(patientAccounts.phoneNormalized, norm.e164)
        )
      )
      .limit(1);

    if (!account) {
      return NextResponse.json({
        found: false,
        phone: norm.e164,
        phoneMasked: maskPhoneNumber(norm.e164),
        phoneLocal: norm.formattedLocal,
        profiles: [],
      });
    }

    // Fetch profiles under this account
    const rawProfiles = await db
      .select()
      .from(patientProfiles)
      .where(eq(patientProfiles.accountId, account.id));

    const now = new Date();

    const profilesWithGrants = await Promise.all(
      rawProfiles.map(async (prof) => {
        let plainName = prof.name;
        if (!plainName && prof.nameEncrypted) {
          try {
            plainName = decryptPatientPii(prof.nameEncrypted);
          } catch {
            plainName = 'Patient Profile';
          }
        }

        // Check if current doctor has active grant
        const [activeGrant] = await db
          .select({
            id: accessGrants.id,
            scope: accessGrants.scope,
            status: accessGrants.status,
            expiresAt: accessGrants.expiresAt,
          })
          .from(accessGrants)
          .where(
            and(
              eq(accessGrants.profileId, prof.id),
              eq(accessGrants.doctorId, user.id),
              eq(accessGrants.status, 'active'),
              or(
                isNull(accessGrants.expiresAt),
                gt(accessGrants.expiresAt, now)
              )
            )
          )
          .limit(1);

        // Check if other doctors have authored records for this profile
        const [otherDocRx] = await db
          .select({ val: count() })
          .from(prescriptions)
          .where(
            and(
              eq(prescriptions.profileId, prof.id),
              ne(prescriptions.doctorId, user.id)
            )
          );

        const [otherDocEnc] = await db
          .select({ val: count() })
          .from(encounters)
          .where(
            and(
              eq(encounters.profileId, prof.id),
              ne(encounters.doctorId, user.id)
            )
          );

        const hasOtherDoctorRecords = (otherDocRx?.val || 0) > 0 || (otherDocEnc?.val || 0) > 0;
        const isAuthor = prof.createdBy === user.id;
        const grantScope = activeGrant ? activeGrant.scope : isAuthor ? 'this_doctor_only' : null;
        const hasFullAccess = grantScope === 'full_history' || isAuthor;

        // Mask name if doctor has not consulted this profile and has no active grant
        const displayName = hasFullAccess ? plainName : maskProfileName(plainName);

        // Audit log search view
        await db.insert(accessLogs).values({
          userId: user.id,
          profileId: prof.id,
          userRole: user.role,
          action: 'PHONE_SEARCH',
          recordType: 'patient_profile',
          recordId: prof.id,
          reason: 'Doctor patient search by mobile phone',
        });

        return {
          id: prof.id,
          name: displayName,
          nameMasked: maskProfileName(plainName),
          relation: prof.relation,
          age: prof.age,
          gender: prof.gender || prof.sex || 'male',
          bloodGroup: prof.bloodGroup,
          hasOtherDoctorRecords,
          hasActiveGrant: Boolean(activeGrant) || isAuthor,
          grantScope,
          expiresAt: activeGrant?.expiresAt || null,
        };
      })
    );

    return NextResponse.json({
      found: true,
      phone: norm.e164,
      phoneMasked: maskPhoneNumber(norm.e164),
      phoneLocal: norm.formattedLocal,
      profiles: profilesWithGrants,
    });
  } catch (error) {
    console.error('Error in /api/patient/search:', error);
    return NextResponse.json({ error: 'Failed to search patients' }, { status: 500 });
  }
}
