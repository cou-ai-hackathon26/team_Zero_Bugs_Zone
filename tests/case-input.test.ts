import { describe, it, expect } from 'vitest';
import { caseInput } from '../src/lib/case-input';

describe('caseInput validation test suite', () => {
  it('validates the user screenshot intake scenario without errors', () => {
    const payload = {
      patient_code: 'P-104',
      structured_input: {
        age: 28,
        gender: 'male',
        chief_complaint: 'Fever, headache, generalized body aches, sore throat, and weakness',
        symptoms: ['Fever', 'Headache', 'Myalgia', 'Sore throat'],
        past_medical_history: ['None'],
        current_medicines: ['Paracetamol 500mg'],
        allergies: ['None'],
        clinical_notes:
          'A 28-year-old male presents with a 3-day history of fever, headache, myalgia, sore throat, and intermittent dry cough. Patient is conscious, alert, and oriented. Mild pharyngeal redness is noted. No respiratory distress observed.',
        vitals: {},
        lab_values: [
          { name: 'Hemoglobin (Hb)', value: 14.2, unit: 'g/dL', reference_range: '' },
          { name: 'Platelet Count', value: '145,000', unit: '/μL', reference_range: undefined },
          { name: 'Hematocrit (HCT)', value: 42, unit: '%', reference_range: '' },
          { name: 'CRP', value: 12, unit: 'mg/L', reference_range: '' },
          { name: 'Dengue NS1 Antigen', value: 'Negative', unit: 'Qualitative', reference_range: '' },
        ],
      },
    };

    const parsed = caseInput.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.patient_code).toBe('P-104');
      expect(parsed.data.structured_input.lab_values.length).toBe(5);
      expect(parsed.data.structured_input.lab_values[0].reference_range).toBeUndefined();
      expect(parsed.data.structured_input.lab_values[1].value).toBe('145,000');
    }
  });

  it('normalizes lowercase patient codes and preprocessed fields', () => {
    const payload = {
      patient_code: 'p-2026-999',
      structured_input: {
        age: '45',
        gender: 'female',
        weight_kg: '68',
        chief_complaint: 'Acute dyspnea and wheezing for 2 hours',
        vitals: {
          blood_pressure_systolic: '130',
          blood_pressure_diastolic: '85',
          heart_rate: '105',
          spo2_percent: '93',
        },
      },
    };

    const parsed = caseInput.safeParse(payload);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.patient_code).toBe('P-2026-999');
      expect(parsed.data.structured_input.age).toBe(45);
      expect(parsed.data.structured_input.weight_kg).toBe(68);
      expect(parsed.data.structured_input.vitals?.blood_pressure_systolic).toBe(130);
      expect(parsed.data.structured_input.vitals?.spo2_percent).toBe(93);
    }
  });
});
