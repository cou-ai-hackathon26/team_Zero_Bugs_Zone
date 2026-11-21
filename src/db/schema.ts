import { pgTable, text, varchar, integer, timestamp, jsonb, uuid, customType, index, boolean, numeric } from 'drizzle-orm/pg-core';
import { vector } from 'drizzle-orm/pg-core';

export const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 50 }).notNull().default('doctor'), // 'super_admin' | 'doctor' | 'student' | 'researcher' | 'patient' | 'medicine_controller'
  name: text('name').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active' | 'pending_verification' | 'suspended'
  mfaSecret: text('mfa_secret'),
  mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  phone: varchar('phone', { length: 30 }),
  bmdcNumber: varchar('bmdc_number', { length: 50 }),
  orgId: uuid('org_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sources = pgTable('sources', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'textbook' | 'guideline' | 'journal' | 'drug'
  year: integer('year').notNull(),
  license: text('license').notNull().default('Open Access / Academic Demo'),
  url: text('url'),
  status: varchar('status', { length: 50 }).notNull().default('active'), // 'active' | 'archived'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const chunks = pgTable('chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceId: uuid('source_id').references(() => sources.id, { onDelete: 'cascade' }).notNull(),
  page: integer('page').default(1),
  section: text('section').notNull(),
  text: text('text').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  tsv: tsvector('tsv'),
  evidenceLevel: varchar('evidence_level', { length: 10 }).notNull().default('Ia'), // 'Ia' | 'Ib' | 'IIa' | 'IIb' | 'III' | 'IV'
  hash: text('hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('chunks_tsv_idx').using('gin', table.tsv),
]);

export const cases = pgTable('cases', {
  id: uuid('id').defaultRandom().primaryKey(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  patientCode: varchar('patient_code', { length: 50 }).notNull(),
  status: varchar('status', { length: 50 }).notNull().default('draft'), // 'draft' | 'analyzed' | 'insufficient_evidence' | 'red_flag' | 'confirmed' | 'treated' | 'closed'
  structuredInput: jsonb('structured_input').notNull(),
  confirmedDiagnosis: text('confirmed_diagnosis'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const caseTurns = pgTable('case_turns', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
  role: varchar('role', { length: 50 }).notNull(), // 'doctor' | 'system'
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const analyses = pgTable('analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'cascade' }).notNull(),
  round: integer('round').notNull().default(1),
  output: jsonb('output').notNull(),
  model: text('model').notNull().default('gpt-4o-mini'),
  tokens: integer('tokens').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const drugs = pgTable('drugs', {
  id: uuid('id').defaultRandom().primaryKey(),
  genericName: text('generic_name').notNull().unique(),
  drugClass: text('drug_class').notNull(),
  indications: jsonb('indications').notNull(), // string[]
  doseRules: jsonb('dose_rules').notNull(), // DoseRules
  contraindications: jsonb('contraindications').notNull(), // Contraindications
  pregnancyCategory: varchar('pregnancy_category', { length: 5 }).notNull().default('C'),
  renalAdjustment: jsonb('renal_adjustment'), // RenalAdjustment
  sourceChunkId: uuid('source_chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const drugInteractions = pgTable('drug_interactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  drugA: text('drug_a').notNull(),
  drugB: text('drug_b').notNull(),
  severity: varchar('severity', { length: 20 }).notNull(), // 'info' | 'warning' | 'critical'
  note: text('note').notNull(),
  sourceChunkId: uuid('source_chunk_id').references(() => chunks.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  event: text('event').notNull(),
  payload: jsonb('payload').notNull(),
  prevHash: varchar('prev_hash', { length: 64 }),
  hash: varchar('hash', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const features = pgTable('features', {
  key: varchar('key', { length: 100 }).primaryKey(),
  description: text('description').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const roleFeatures = pgTable('role_features', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: varchar('role', { length: 50 }).notNull(),
  featureKey: varchar('feature_key', { length: 100 }).references(() => features.key, { onDelete: 'cascade' }).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  dailyLimit: integer('daily_limit'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const userFeatureOverrides = pgTable('user_feature_overrides', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  featureKey: varchar('feature_key', { length: 100 }).references(() => features.key, { onDelete: 'cascade' }).notNull(),
  enabled: boolean('enabled').notNull(),
  dailyLimit: integer('daily_limit'),
  expiresAt: timestamp('expires_at'),
  reason: text('reason'),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const doctorVerifications = pgTable('doctor_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  bmdcNumber: varchar('bmdc_number', { length: 50 }).notNull(),
  documentUrl: text('document_url').notNull(),
  status: varchar('status', { length: 30 }).default('pending').notNull(), // 'pending' | 'approved' | 'rejected'
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const studentVerifications = pgTable('student_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  studentId: uuid('student_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  instituteName: text('institute_name').notNull(),
  studentIdNumber: varchar('student_id_number', { length: 50 }).notNull(),
  instituteEmail: varchar('institute_email', { length: 255 }),
  documentUrl: text('document_url'),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const researcherVerifications = pgTable('researcher_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  researcherId: uuid('researcher_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  instituteName: text('institute_name').notNull(),
  orcid: varchar('orcid', { length: 50 }),
  instituteEmail: varchar('institute_email', { length: 255 }),
  documentUrl: text('document_url'),
  status: varchar('status', { length: 30 }).default('pending').notNull(),
  rejectionReason: text('rejection_reason'),
  reviewedBy: uuid('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt: timestamp('reviewed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: varchar('ip_address', { length: 64 }),
  expiresAt: timestamp('expires_at').notNull(),
  revoked: boolean('revoked').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const systemSettings = pgTable('system_settings', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: jsonb('value').notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const patients = pgTable('patients', {
  id: uuid('id').defaultRandom().primaryKey(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  patientCode: varchar('patient_code', { length: 50 }).notNull(),
  nameEncrypted: text('name_encrypted').notNull(),
  phoneEncrypted: text('phone_encrypted'),
  age: integer('age').notNull(),
  gender: varchar('gender', { length: 20 }).notNull(),
  bloodGroup: varchar('blood_group', { length: 10 }),
  emergencyContact: text('emergency_contact'),
  consentObtained: boolean('consent_obtained').default(true).notNull(),
  consentObtainedAt: timestamp('consent_obtained_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const encounters = pgTable('encounters', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'set null' }),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  visitDate: timestamp('visit_date', { withTimezone: true }).defaultNow().notNull(),
  chiefComplaint: text('chief_complaint').notNull(),
  symptoms: jsonb('symptoms').notNull(),
  vitals: jsonb('vitals').notNull(),
  allergies: jsonb('allergies').notNull(),
  currentMedications: jsonb('current_medications').notNull(),
  pastHistory: text('past_history'),
  clinicalNotes: text('clinical_notes'),
  status: varchar('status', { length: 30 }).default('in_progress').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const prescriptions = pgTable('prescriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'set null' }),
  patientId: uuid('patient_id').references(() => patients.id, { onDelete: 'cascade' }).notNull(),
  doctorId: uuid('doctor_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  rxNumber: varchar('rx_number', { length: 50 }).notNull().unique(),
  diagnosis: text('diagnosis'),
  investigations: jsonb('investigations').notNull(),
  generalAdvice: text('general_advice'),
  followUpText: varchar('follow_up_text', { length: 100 }),
  status: varchar('status', { length: 30 }).default('draft').notNull(), // 'draft' | 'finalized'
  qrHash: varchar('qr_hash', { length: 64 }).notNull().unique(),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const prescriptionItems = pgTable('prescription_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  prescriptionId: uuid('prescription_id').references(() => prescriptions.id, { onDelete: 'cascade' }).notNull(),
  brandName: varchar('brand_name', { length: 100 }).notNull(),
  genericName: varchar('generic_name', { length: 100 }).notNull(),
  strength: varchar('strength', { length: 50 }).notNull(),
  form: varchar('form', { length: 50 }).default('Tab').notNull(),
  dosingSchedule: varchar('dosing_schedule', { length: 50 }).notNull(),
  mealTiming: varchar('meal_timing', { length: 50 }).default('খাবারের পর').notNull(),
  durationDays: integer('duration_days').default(7).notNull(),
  durationText: varchar('duration_text', { length: 50 }).default('৭ দিন').notNull(),
  instructions: text('instructions'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const medicineBrands = pgTable('medicine_brands', {
  id: uuid('id').defaultRandom().primaryKey(),
  brandName: varchar('brand_name', { length: 150 }).notNull(),
  genericName: varchar('generic_name', { length: 150 }).notNull(),
  manufacturer: varchar('manufacturer', { length: 150 }).notNull(),
  form: varchar('form', { length: 50 }).default('Tab').notNull(),
  strength: varchar('strength', { length: 50 }).notNull(),
  packSize: varchar('pack_size', { length: 50 }).default('10x10'),
  priceBdt: numeric('price_bdt', { precision: 10, scale: 2 }).default('0.00'),
  dgdaRegNum: varchar('dgda_reg_num', { length: 50 }),
  status: varchar('status', { length: 30 }).default('approved').notNull(), // 'pending' | 'partially_approved' | 'approved' | 'rejected'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const medicineVersions = pgTable('medicine_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  medicineId: uuid('medicine_id').references(() => medicineBrands.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').default(1).notNull(),
  changesJson: jsonb('changes_json').notNull(),
  reviewedBy1: uuid('reviewed_by_1').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt1: timestamp('reviewed_at_1', { withTimezone: true }),
  reviewedBy2: uuid('reviewed_by_2').references(() => users.id, { onDelete: 'set null' }),
  reviewedAt2: timestamp('reviewed_at_2', { withTimezone: true }),
  status: varchar('status', { length: 30 }).default('pending').notNull(), // 'pending' | 'partially_approved' | 'approved' | 'rejected'
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const medicineNotices = pgTable('medicine_notices', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  severity: varchar('severity', { length: 30 }).default('info').notNull(), // 'info' | 'warning' | 'critical_recall'
  body: text('body').notNull(),
  affectedBatches: jsonb('affected_batches').notNull(),
  publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
  publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

