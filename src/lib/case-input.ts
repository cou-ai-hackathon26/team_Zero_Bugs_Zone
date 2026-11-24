import { z } from 'zod';

const shortText = z.string().trim().min(1).max(500);
const note = z.string().trim().max(30000);
const list = z.array(z.string().trim().max(1000)).transform((arr) => arr.filter((s) => s.length > 0));
const vital = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
  z.number().finite().nonnegative().max(500).optional()
);

export const caseInput = z.object({
  patient_code: z
    .string()
    .trim()
    .regex(/^[Pp]-(?:[0-9A-Za-z]+-)*[0-9A-Za-z]+$/, 'Invalid patient code format (e.g. P-104 or P-2026-104)')
    .transform((v) => v.toUpperCase()),
  profile_id: z.string().trim().max(100).nullable().optional(),
  idempotency_key: z.string().trim().max(100).nullable().optional(),
  structured_input: z.object({
    age: z.preprocess(
      (val) => (typeof val === 'string' && val.trim() !== '' ? Number(val) : val),
      z.number().int().min(0).max(130)
    ),
    gender: z.enum(['male', 'female', 'other']),
    weight_kg: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
      z.number().positive().max(1000).optional()
    ),
    chief_complaint: z.string().trim().min(1).max(2000),
    symptoms: list.optional().default([]),
    past_medical_history: list.optional().default([]),
    current_medicines: list.optional().default([]),
    allergies: list.optional().default([]),
    history_of_present_illness: note.optional(),
    clinical_notes: note.optional(),
    vitals: z.object({
      blood_pressure_systolic: vital,
      blood_pressure_diastolic: vital,
      heart_rate: vital,
      respiratory_rate: vital,
      temperature_celsius: vital,
      spo2_percent: z.preprocess(
        (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
        z.number().min(0).max(100).optional()
      ),
    }).optional().default({}),
    lab_values: z.array(z.object({
      name: z.string().trim().min(1).max(250),
      unit: z.string().trim().max(100).optional().default(''),
      value: z.union([
        z.string().trim().min(1).max(250),
        z.number(),
      ]),
      reference_range: z.union([
        z.string().trim().max(250),
        z.literal(''),
        z.null(),
        z.undefined(),
      ]).optional().transform((v) => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined)),
    })).max(100).optional().default([]),
    is_pregnant: z.preprocess((val) => Boolean(val), z.boolean().optional()),
    pregnancy_trimester: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? undefined : Number(val)),
      z.union([z.literal(1), z.literal(2), z.literal(3)]).optional()
    ),
    egfr: vital,
  }),
});
