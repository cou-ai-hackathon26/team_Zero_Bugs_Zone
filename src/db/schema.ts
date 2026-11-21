import { pgTable, text, varchar, integer, timestamp, jsonb, uuid, customType, index, boolean } from 'drizzle-orm/pg-core';
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
