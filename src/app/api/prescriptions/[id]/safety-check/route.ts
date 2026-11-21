import { NextResponse } from 'next/server';
import { db } from '@/db';
import { prescriptions, prescriptionItems, encounters, drugs, drugInteractions, medicineNotices } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';
import { assertPatientDataScope } from '@/lib/permissions';
import { checkAllergies, checkInteractions } from '@/lib/safety-engine';
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
    });
    if (!scopeCheck.allowed) {
      return NextResponse.json({ error: `Access denied: ${scopeCheck.reason}` }, { status: 403 });
    }

    // Get items in prescription
    const items = await db.query.prescriptionItems.findMany({
      where: eq(prescriptionItems.prescriptionId, rx.id),
    });

    // Get patient allergies & existing meds
    let patientAllergies: string[] = [];
    if (rx.encounterId) {
      const [encounter] = await db.select().from(encounters).where(eq(encounters.id, rx.encounterId)).limit(1);
      if (encounter && Array.isArray(encounter.allergies)) {
        patientAllergies = encounter.allergies as string[];
      }
    }

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

    // 1. Check each item against patient allergies
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
    }

    // 2. Check drug-drug interactions among all items
    const allPrescribedGenerics = items.map((i) => i.genericName);
    for (const item of items) {
      const otherMeds = allPrescribedGenerics.filter(
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
    });
  } catch (err) {
    console.error('Safety check execution failed:', err);
    return NextResponse.json({ error: 'Safety check execution failed' }, { status: 500 });
  }
}
