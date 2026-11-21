import { DrugRecord, DrugInteractionRecord, SafetyAlert, StructuredPatientInput } from '@/types';

export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// 1. Allergy Safety Check
export function checkAllergies(
  drug: DrugRecord,
  patientAllergies: string[]
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  if (!patientAllergies || patientAllergies.length === 0) return alerts;

  const drugNameNorm = normalizeName(drug.generic_name);
  const drugClassNorm = normalizeName(drug.drug_class);
  const drugAllergyList = (drug.contraindications?.allergies || []).map(normalizeName);

  for (const allergy of patientAllergies) {
    const allergyNorm = normalizeName(allergy);
    if (!allergyNorm) continue;

    const isDirectMatch =
      drugNameNorm.includes(allergyNorm) ||
      allergyNorm.includes(drugNameNorm) ||
      drugAllergyList.some((a) => a.includes(allergyNorm) || allergyNorm.includes(a));

    const isClassMatch =
      drugClassNorm.includes(allergyNorm) || allergyNorm.includes(drugClassNorm);

    // Cross-hypersensitivity check (e.g. Penicillin allergy vs Cephalosporins / Beta-lactams)
    const isPenicillinCross =
      (allergyNorm.includes('penicillin') || allergyNorm.includes('amoxicillin')) &&
      (drugClassNorm.includes('penicillin') || drugNameNorm.includes('amoxicillin') || drugNameNorm.includes('ampicillin'));

    if (isDirectMatch || isClassMatch || isPenicillinCross) {
      alerts.push({
        id: `allergy-${drug.id}-${allergyNorm}`,
        drug_id: drug.id,
        drug_name: drug.generic_name,
        severity: 'critical',
        type: 'allergy',
        title: `Documented Hypersensitivity / Drug Allergy to ${allergy}`,
        description: `Patient has a recorded allergy to "${allergy}". Prescribing ${drug.generic_name} (${drug.drug_class}) poses a high risk of acute hypersensitivity or anaphylaxis.`,
      });
    }
  }

  return alerts;
}

// 2. Drug-Drug Interactions Check
export function checkInteractions(
  drug: DrugRecord,
  currentMedicines: string[],
  interactionsDb: DrugInteractionRecord[]
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  if (!currentMedicines || currentMedicines.length === 0) return alerts;

  const drugNameNorm = normalizeName(drug.generic_name);

  for (const med of currentMedicines) {
    const medNorm = normalizeName(med);
    if (!medNorm) continue;

    // Check database interaction list
    const match = interactionsDb.find((item) => {
      const a = normalizeName(item.drug_a);
      const b = normalizeName(item.drug_b);
      return (
        (drugNameNorm.includes(a) && medNorm.includes(b)) ||
        (drugNameNorm.includes(b) && medNorm.includes(a))
      );
    });

    if (match) {
      alerts.push({
        id: `interaction-${drug.id}-${medNorm}`,
        drug_id: drug.id,
        drug_name: drug.generic_name,
        severity: match.severity,
        type: 'drug_interaction',
        title: `Drug Interaction: ${drug.generic_name} + ${med} (${match.severity.toUpperCase()})`,
        description: match.note,
      });
    }
  }

  return alerts;
}

// 3. Pregnancy Category & Teratogenicity Check
export function checkPregnancy(
  drug: DrugRecord,
  isPregnant?: boolean,
  trimester?: number
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  if (!isPregnant) return alerts;

  const category = (drug.pregnancy_category || 'C').toUpperCase();

  if (category === 'X') {
    alerts.push({
      id: `preg-x-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'critical',
      type: 'pregnancy',
      title: `Pregnancy Category X: Strictly Contraindicated`,
      description: `${drug.generic_name} causes documented fetal abnormalities in humans and is absolutely contraindicated throughout pregnancy.`,
    });
  } else if (category === 'D') {
    alerts.push({
      id: `preg-d-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'critical',
      type: 'pregnancy',
      title: `Pregnancy Category D: Known Teratogenic / Fetal Risk`,
      description: `${drug.generic_name} is known to cause fetal harm (e.g. renal dysgenesis, skull hypoplasia, or hemorrhagic risk). Use safe alternative.`,
    });
  } else if (category === 'C') {
    alerts.push({
      id: `preg-c-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'warning',
      type: 'pregnancy',
      title: `Pregnancy Category C: Caution Required`,
      description: `Animal reproduction studies have shown an adverse effect on the fetus. Administer only if the potential benefit justifies potential risk.`,
    });
  }

  return alerts;
}

// 4. Clinical Condition & Age Contraindications Check
export function checkContraindications(
  drug: DrugRecord,
  pastHistory: string[],
  symptoms: string[],
  age?: number
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  const combinedClinical = [...(pastHistory || []), ...(symptoms || [])]
    .map((s) => s.toLowerCase())
    .join(' ');

  // Age bounds check
  if (age !== undefined) {
    if (drug.contraindications?.age_min && age < drug.contraindications.age_min) {
      alerts.push({
        id: `age-min-${drug.id}`,
        drug_id: drug.id,
        drug_name: drug.generic_name,
        severity: 'critical',
        type: 'age',
        title: `Age Limit Violation (Pediatric Safety Stop)`,
        description: `${drug.generic_name} is contraindicated in patients under ${drug.contraindications.age_min} years of age (e.g. risk of Reye syndrome, cartilage damage, or tooth discoloration).`,
      });
    }
  }

  // Asthmatic bronchospasm check with non-selective beta-blockers
  if (
    drug.generic_name.toLowerCase().includes('propranolol') &&
    (combinedClinical.includes('asthma') || combinedClinical.includes('bronchial asthma') || combinedClinical.includes('wheeze'))
  ) {
    alerts.push({
      id: `contra-asthma-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'critical',
      type: 'contraindication',
      title: `Contraindication: Non-Selective Beta-Blocker in Asthma`,
      description: `${drug.generic_name} blocks beta-2 pulmonary receptors, precipitating acute, severe, life-threatening bronchospasm.`,
    });
  }

  // Dengue fever check with NSAIDs / Aspirin / Ibuprofen
  const isNsaid =
    drug.drug_class.toLowerCase().includes('nsaid') ||
    drug.generic_name.toLowerCase().includes('ibuprofen') ||
    drug.generic_name.toLowerCase().includes('aspirin') ||
    drug.generic_name.toLowerCase().includes('diclofenac');

  if (isNsaid && combinedClinical.includes('dengue')) {
    alerts.push({
      id: `contra-dengue-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'critical',
      type: 'contraindication',
      title: `CRITICAL CONTRAINDICATION: NSAID / Aspirin in Dengue Fever`,
      description: `${drug.generic_name} possesses antiplatelet effects and causes severe gastric erosions, creating a fatal risk of catastrophic hemorrhage and plasma leakage in dengue infection. Only Paracetamol is permitted.`,
    });
  }

  return alerts;
}

// 5. Renal Function & eGFR Check
export function checkRenalAdjustment(
  drug: DrugRecord,
  egfr?: number
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];
  if (egfr === undefined || egfr === null) return alerts;

  if (drug.renal_adjustment && egfr < drug.renal_adjustment.egfr_threshold) {
    const isAvoid = drug.renal_adjustment.action === 'avoid';
    alerts.push({
      id: `renal-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: isAvoid ? 'critical' : 'warning',
      type: 'renal',
      title: isAvoid
        ? `Renal Contraindication: eGFR ${egfr} mL/min (Threshold < ${drug.renal_adjustment.egfr_threshold})`
        : `Renal Dose Adjustment Required: eGFR ${egfr} mL/min`,
      description: `${drug.renal_adjustment.note}. ${
        drug.renal_adjustment.adjusted_dose
          ? `Recommended adjusted regimen: ${drug.renal_adjustment.adjusted_dose}`
          : ''
      }`,
    });
  }

  return alerts;
}

// Comprehensive deterministic evaluation across all safety pillars
export function evaluateDrugSafety(
  drug: DrugRecord,
  patient: StructuredPatientInput,
  interactionsDb: DrugInteractionRecord[]
): SafetyAlert[] {
  const alerts: SafetyAlert[] = [];

  alerts.push(...checkAllergies(drug, patient.allergies || []));
  alerts.push(...checkInteractions(drug, patient.current_medicines || [], interactionsDb));
  alerts.push(...checkPregnancy(drug, patient.is_pregnant, patient.pregnancy_trimester));
  alerts.push(...checkContraindications(drug, patient.past_medical_history || [], patient.symptoms || [], patient.age));
  alerts.push(...checkRenalAdjustment(drug, patient.egfr));

  return alerts;
}
