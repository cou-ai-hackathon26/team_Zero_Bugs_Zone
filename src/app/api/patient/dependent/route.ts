import { NextResponse } from 'next/server';
import { db } from '@/db';
import { patientProfiles, patientAccounts, profileHealthSummary } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { encryptPatientPii } from '@/lib/encryption';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { name, relation, age, gender, bloodGroup } = body;

    if (!name || !name.trim() || !age || !gender || !relation) {
      return NextResponse.json(
        { error: 'নাম, বয়স, লিঙ্গ ও সম্পর্ক প্রদান আবশ্যক (Name, age, gender, and relation are required)' },
        { status: 400 }
      );
    }

    // Resolve Account
    let account = null;
    if (user.phone) {
      const [acc] = await db
        .select()
        .from(patientAccounts)
        .where(eq(patientAccounts.phone, user.phone))
        .limit(1);
      account = acc;
    }

    if (!account) {
      const allAccs = await db.select().from(patientAccounts).limit(1);
      if (allAccs.length > 0) {
        account = allAccs[0];
      }
    }

    if (!account) {
      return NextResponse.json({ error: 'Patient account not found' }, { status: 404 });
    }

    // Insert new dependent profile
    const [newProfile] = await db
      .insert(patientProfiles)
      .values({
        accountId: account.id,
        relation,
        name: name.trim(),
        nameEncrypted: encryptPatientPii(name.trim()),
        age: Number(age),
        gender,
        sex: gender,
        bloodGroup: bloodGroup || null,
        createdBy: user.id,
        claimed: true,
      })
      .returning();

    // Create initial health summary version 1
    await db.insert(profileHealthSummary).values({
      profileId: newProfile.id,
      version: 1,
      allergies: [],
      chronicConditions: [],
      currentMedicines: [],
      bloodGroup: bloodGroup || null,
      updatedBy: user.id,
      changeReason: 'Profile created by patient in patient portal',
    });

    return NextResponse.json({
      success: true,
      message: 'পরিবারের সদস্যের প্রোফাইল সফলভাবে তৈরি হয়েছে (Family profile added successfully)',
      profile: {
        id: newProfile.id,
        name: newProfile.name,
        relation: newProfile.relation,
        age: newProfile.age,
        gender: newProfile.gender,
        bloodGroup: newProfile.bloodGroup,
        claimed: newProfile.claimed,
      },
    });
  } catch (error) {
    console.error('Add dependent profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
