import { pgTable, text, varchar, integer, timestamp, jsonb, uuid, customType, index } from 'drizzle-orm/pg-core';
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
  role: varchar('role', { length: 50 }).notNull().default('doctor'), // 'doctor' | 'student' | 'researcher' | 'admin'
  name: text('name').notNull(),
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
