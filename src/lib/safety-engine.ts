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

    if (isDirectMatch || isClassMatch) {
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
  isPregnant?: boolean
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
  const clinical = [...pastHistory, ...symptoms].map(normalizeName);
  for (const condition of drug.contraindications.conditions) {
    const normalized = normalizeName(condition);
    if (!normalized || !clinical.includes(normalized)) continue;
    alerts.push({
      id: `condition-${drug.id}-${normalized}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'critical',
      type: 'contraindication',
      title: `Recorded contraindication: ${condition}`,
      description: `The formulary lists this condition as a contraindication for ${drug.generic_name}.`,
    });
  }

  const { age_min: minimum, age_max: maximum } = drug.contraindications;
  if (age !== undefined && minimum !== undefined && age < minimum) {
    alerts.push({
      id: `age-min-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'critical',
      type: 'age',
      title: 'Age Limit Violation (Pediatric Safety Stop)',
      description: `Formulary minimum age: ${minimum} years.`,
    });
  }
  if (age !== undefined && maximum !== undefined && age > maximum) {
    alerts.push({
      id: `age-max-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'critical',
      type: 'age',
      title: 'Age Limit Violation (Upper Age Safety Stop)',
      description: `Formulary maximum age: ${maximum} years.`,
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
  alerts.push(...checkPregnancy(drug, patient.is_pregnant));
  alerts.push(...checkContraindications(drug, patient.past_medical_history || [], patient.symptoms || [], patient.age));
  alerts.push(...checkRenalAdjustment(drug, patient.egfr));

  const genericName = normalizeName(drug.generic_name);
  const duplicate = genericName && patient.current_medicines?.some((medicine) => {
    const ingredient = medicine.split(/\s+(?=\d)/, 1)[0];
    return normalizeName(ingredient) === genericName;
  });
  if (duplicate) {
    alerts.push({
      id: `duplicate-${drug.id}`,
      drug_id: drug.id,
      drug_name: drug.generic_name,
      severity: 'critical',
      type: 'duplicate_therapy',
      title: 'Duplicate active ingredient',
      description: `${drug.generic_name} is already recorded in the current medication list.`,
    });
  }

  return alerts;
}

export interface RegimenAcknowledgment {
  alert_id: string;
  drug_id: string;
  case_version: string;
  regimen_hash: string;
  acknowledged_at: string;
  acknowledged_by?: string;
}

export function computeRegimenHash(drugIds: string[]): string {
  return [...drugIds].sort().join(',');
}

export function computeCaseVersion(patient: StructuredPatientInput, updatedAt?: string | Date): string {
  if (typeof updatedAt === 'string') return updatedAt;
  if (updatedAt instanceof Date) return updatedAt.toISOString();
  const relevant = {
    allergies: patient.allergies || [],
    current_medicines: patient.current_medicines || [],
    egfr: patient.egfr,
    is_pregnant: patient.is_pregnant,
    age: patient.age,
    vitals: patient.vitals || {},
    past_history: patient.past_medical_history || [],
  };
  return JSON.stringify(relevant);
}

export function isHardStop(alert: SafetyAlert): boolean {
  if (alert.type === 'allergy' && alert.severity === 'critical') return true;
  if (alert.type === 'pregnancy' && alert.severity === 'critical') return true;
  return false;
}

export function isAcknowledgmentValid(
  ack: RegimenAcknowledgment,
  currentCaseVersion: string,
  currentRegimenHash: string,
): boolean {
  return ack.case_version === currentCaseVersion && ack.regimen_hash === currentRegimenHash;
}

export interface RegimenSafetyVerification {
  isValid: boolean;
  alerts: SafetyAlert[];
  unacknowledgedCritical: SafetyAlert[];
  staleAcknowledgments: RegimenAcknowledgment[];
  hardStops: SafetyAlert[];
}

export function recomputeRegimenSafety(
  drugs: DrugRecord[],
  patient: StructuredPatientInput,
  interactionsDb: DrugInteractionRecord[],
  existingAcks: RegimenAcknowledgment[],
  currentCaseVersion: string,
): RegimenSafetyVerification {
  const currentRegimenHash = computeRegimenHash(drugs.map((d) => d.id));
  const allAlerts: SafetyAlert[] = [];

  for (const drug of drugs) {
    const drugAlerts = evaluateDrugSafety(drug, patient, interactionsDb);
    allAlerts.push(...drugAlerts);
  }

  for (let i = 0; i < drugs.length; i++) {
    for (let j = i + 1; j < drugs.length; j++) {
      const drugA = normalizeName(drugs[i].generic_name);
      const drugB = normalizeName(drugs[j].generic_name);
      const match = interactionsDb.find((item) => {
        const a = normalizeName(item.drug_a);
        const b = normalizeName(item.drug_b);
        return (drugA.includes(a) && drugB.includes(b)) || (drugA.includes(b) && drugB.includes(a));
      });
      if (match) {
        allAlerts.push({
          id: `regimen-interaction-${drugs[i].id}-${drugs[j].id}`,
          drug_id: drugs[i].id,
          drug_name: `${drugs[i].generic_name} + ${drugs[j].generic_name}`,
          severity: match.severity,
          type: 'drug_interaction',
          title: `Inter-Regimen Drug Interaction: ${drugs[i].generic_name} + ${drugs[j].generic_name}`,
          description: match.note,
        });
      }
    }
  }

  const hardStops = allAlerts.filter(isHardStop);
  const staleAcknowledgments: RegimenAcknowledgment[] = [];
  const validAckIds = new Set<string>();

  for (const ack of existingAcks) {
    if (isAcknowledgmentValid(ack, currentCaseVersion, currentRegimenHash)) {
      validAckIds.add(ack.alert_id);
    } else {
      staleAcknowledgments.push(ack);
    }
  }

  const criticalAlerts = allAlerts.filter((a) => a.severity === 'critical');
  const unacknowledgedCritical = criticalAlerts.filter((a) => !validAckIds.has(a.id));

  const isValid = hardStops.length === 0 && unacknowledgedCritical.length === 0;

  return {
    isValid,
    alerts: allAlerts,
    unacknowledgedCritical,
    staleAcknowledgments,
    hardStops,
  };
}
