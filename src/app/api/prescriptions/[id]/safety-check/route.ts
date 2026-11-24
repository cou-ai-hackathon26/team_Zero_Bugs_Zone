import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  prescriptions,
  prescriptionItems,
  encounters,
  drugs,
  drugInteractions,
  medicineNotices,
  profileHealthSummary,
  accessGrants,
} from '@/db/schema';
import { eq, and, ne, or, gt, isNull, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { assertPatientDataScope } from '@/lib/permissions';
import { checkAllergies, checkInteractions, checkContraindications } from '@/lib/safety-engine';
import { DrugRecord, DrugInteractionRecord, SafetyAlert } from '@/types';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: rxId } = await params;

    const [rx] = await db.select().from(prescriptions).where(eq(prescriptions.id, rxId)).limit(1);
    if (!rx) {
      return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
    }

    const scopeCheck = await assertPatientDataScope({
      user,
      caseDoctorId: rx.doctorId,
      patientId: rx.patientId,
      profileId: rx.profileId,
    });
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: `Access denied: ${scopeCheck.reason}` }, { status: 403 });
    }

    // Get items in prescription
    const items = await db.query.prescriptionItems.findMany({
      where: eq(prescriptionItems.prescriptionId, rx.id),
    });

    // Gather allergies and chronic conditions
    let patientAllergies: string[] = [];
    const chronicConditions: string[] = [];
    let externalMedicines: string[] = [];
    let hasFullGrant = false;

    // Check encounter if exists
    if (rx.encounterId) {
      const [encounter] = await db.select().from(encounters).where(eq(encounters.id, rx.encounterId)).limit(1);
      if (encounter && Array.isArray(encounter.allergies)) {
        patientAllergies.push(...(encounter.allergies as string[]));
      }
    }

    // Check profile health summary & cross-doctor grant if profileId exists
    if (rx.profileId) {
      const [summary] = await db
        .select()
        .from(profileHealthSummary)
        .where(eq(profileHealthSummary.profileId, rx.profileId))
        .orderBy(desc(profileHealthSummary.version))
        .limit(1);

      if (summary) {
        if (Array.isArray(summary.allergies)) {
          patientAllergies.push(...(summary.allergies as string[]));
        }
        if (Array.isArray(summary.chronicConditions)) {
          chronicConditions.push(...(summary.chronicConditions as string[]));
        }
        if (Array.isArray(summary.currentMedicines)) {
          for (const m of summary.currentMedicines as Array<{ brand?: string; generic?: string }>) {
            if (m.generic) externalMedicines.push(m.generic);
            else if (m.brand) externalMedicines.push(m.brand);
          }
        }
      }

      // Check active full_history grant
      const now = new Date();
      const [activeGrant] = await db
        .select({ id: accessGrants.id })
        .from(accessGrants)
        .where(
          and(
            eq(accessGrants.profileId, rx.profileId),
            eq(accessGrants.doctorId, user.id),
            eq(accessGrants.status, 'active'),
            eq(accessGrants.scope, 'full_history'),
            or(isNull(accessGrants.expiresAt), gt(accessGrants.expiresAt, now))
          )
        )
        .limit(1);

      if (activeGrant) {
        hasFullGrant = true;
        // Fetch active prescriptions from other doctors
        const otherRxList = await db
          .select({ id: prescriptions.id })
          .from(prescriptions)
          .where(
            and(
              eq(prescriptions.profileId, rx.profileId),
              ne(prescriptions.doctorId, user.id)
            )
          );

        for (const otherRx of otherRxList) {
          const otherItems = await db
            .select({ genericName: prescriptionItems.genericName })
            .from(prescriptionItems)
            .where(eq(prescriptionItems.prescriptionId, otherRx.id));
          for (const it of otherItems) {
            externalMedicines.push(it.genericName);
          }
        }
      } else {
        // Check if other doctors have records
        const otherRxCount = await db
          .select({ id: prescriptions.id })
          .from(prescriptions)
          .where(
            and(
              eq(prescriptions.profileId, rx.profileId),
              ne(prescriptions.doctorId, user.id)
            )
          )
          .limit(1);

        if (otherRxCount.length > 0) {
          hasFullGrant = false;
        }
      }
    }

    // Deduplicate allergies
    patientAllergies = Array.from(new Set(patientAllergies.filter(Boolean)));
    externalMedicines = Array.from(new Set(externalMedicines.filter(Boolean)));

    // Fetch drugs & interactions db
    const allDrugs = await db.select().from(drugs);
    const allInteractions = await db.select().from(drugInteractions);

    const interactionsDb: DrugInteractionRecord[] = allInteractions.map((i) => ({
      id: i.id,
      drug_a: i.drugA,
      drug_b: i.drugB,
      severity: i.severity as 'critical' | 'warning' | 'info',
      note: i.note,
    }));

    const alerts: SafetyAlert[] = [];

    // Warn if other doctors' records exist but no grant
    if (rx.profileId && !hasFullGrant) {
      alerts.push({
        id: 'warning-missing-grant-cross-doctor',
        drug_id: rx.id,
        drug_name: 'Patient Consent',
        severity: 'warning',
        type: 'drug_interaction',
        title: 'অন্যান্য ডাক্তারের ওষুধ যাচাই করা সম্ভব হয়নি (Cross-Doctor Interaction Check Excluded)',
        description: 'রোগীর অন্য ডাক্তারের পূর্বের ওষুধ এই নিরাপত্তা যাচাইয়ে অন্তর্ভুক্ত করা যায়নি। সম্পূর্ণ নিরাপত্তা যাচাইয়ের জন্য রোগীর ওটিপি অনুমোদন নিন।',
      });
    }

    // 1. Check each item against patient allergies and chronic contraindications
    for (const item of items) {
      const matchedDrug = allDrugs.find(
        (d) => d.genericName.toLowerCase() === item.genericName.toLowerCase()
      );

      const drugObj: DrugRecord = matchedDrug
        ? {
            id: matchedDrug.id,
            generic_name: matchedDrug.genericName,
            drug_class: matchedDrug.drugClass,
            indications: (matchedDrug.indications as string[]) || [],
            dose_rules: matchedDrug.doseRules as DrugRecord['dose_rules'],
            contraindications: (matchedDrug.contraindications as DrugRecord['contraindications']) || {},
            pregnancy_category: matchedDrug.pregnancyCategory as DrugRecord['pregnancy_category'],
          }
        : {
            id: item.id,
            generic_name: item.genericName,
            drug_class: item.form,
            indications: [],
            dose_rules: {
              standard_adult: 'Standard dose',
              route: 'oral',
              frequency: '1+0+1',
              duration_days: 7,
            },
            contraindications: { conditions: [], allergies: [item.genericName.toLowerCase()] },
            pregnancy_category: 'C',
          };

      const allergyAlerts = checkAllergies(drugObj, patientAllergies);
      alerts.push(...allergyAlerts);

      const contraAlerts = checkContraindications(drugObj, chronicConditions, []);
      alerts.push(...contraAlerts);
    }

    // 2. Check drug-drug interactions among all items AND external medicines
    const allPrescribedGenerics = items.map((i) => i.genericName);
    const combinedAllMeds = Array.from(new Set([...allPrescribedGenerics, ...externalMedicines]));

    for (const item of items) {
      const otherMeds = combinedAllMeds.filter(
        (g) => g.toLowerCase() !== item.genericName.toLowerCase()
      );

      const matchedDrug = allDrugs.find(
        (d) => d.genericName.toLowerCase() === item.genericName.toLowerCase()
      );

      const drugObj: DrugRecord = matchedDrug
        ? {
            id: matchedDrug.id,
            generic_name: matchedDrug.genericName,
            drug_class: matchedDrug.drugClass,
            indications: (matchedDrug.indications as string[]) || [],
            dose_rules: matchedDrug.doseRules as DrugRecord['dose_rules'],
            contraindications: (matchedDrug.contraindications as DrugRecord['contraindications']) || {},
            pregnancy_category: matchedDrug.pregnancyCategory as DrugRecord['pregnancy_category'],
          }
        : {
            id: item.id,
            generic_name: item.genericName,
            drug_class: item.form,
            indications: [],
            dose_rules: {
              standard_adult: 'Standard dose',
              route: 'oral',
              frequency: '1+0+1',
              duration_days: 7,
            },
            contraindications: { conditions: [], allergies: [] },
            pregnancy_category: 'C',
          };

      const interactionAlerts = checkInteractions(drugObj, otherMeds, interactionsDb);
      alerts.push(...interactionAlerts);
    }

    // 3. Check items against DGDA critical recall notices
    const recallNotices = await db
      .select()
      .from(medicineNotices)
      .where(eq(medicineNotices.severity, 'critical_recall'));

    for (const item of items) {
      for (const notice of recallNotices) {
        if (
          notice.title.toLowerCase().includes(item.genericName.toLowerCase()) ||
          notice.body.toLowerCase().includes(item.genericName.toLowerCase()) ||
          notice.title.toLowerCase().includes(item.brandName.toLowerCase())
        ) {
          alerts.push({
            id: `notice-recall-${item.id}`,
            drug_id: item.id,
            drug_name: item.brandName,
            severity: 'critical',
            type: 'contraindication',
            title: `ডিজিডিএ জরুরি প্রত্যাহার (DGDA Recall): ${item.brandName}`,
            description: `${notice.title} — ${notice.body}`,
          });
        }
      }
    }

    // Deduplicate alerts by id
    const uniqueAlerts = Array.from(new Map(alerts.map((a) => [a.id, a])).values());
    const hasCriticalStop = uniqueAlerts.some((a) => a.severity === 'critical');

    return NextResponse.json({
      alerts: uniqueAlerts,
      has_critical_stop: hasCriticalStop,
      safe_to_finalize: !hasCriticalStop,
      checked_items_count: items.length,
      allergies_checked: patientAllergies,
      chronic_conditions_checked: chronicConditions,
      external_medicines_checked: externalMedicines,
      full_grant_active: hasFullGrant,
    });
  } catch (err) {
    console.error('Safety check execution failed:', err);
    return NextResponse.json({ error: 'Safety check execution failed' }, { status: 500 });
  }
}
