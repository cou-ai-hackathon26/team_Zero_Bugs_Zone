export type UserRole = 'super_admin' | 'doctor' | 'student' | 'researcher' | 'patient' | 'medicine_controller';

export type FeatureKey =
  | 'patients.manage'
  | 'ai.analyze'
  | 'ai.treatment'
  | 'prescription.create'
  | 'library.ask'
  | 'library.browse'
  | 'library.manage'
  | 'medicine.search'
  | 'medicine.interactions'
  | 'medicine.manage'
  | 'medicine.notices'
  | 'study.tools'
  | 'research.tools'
  | 'patient.portal'
  | 'feedback.send'
  | 'feedback.review'
  | 'users.manage'
  | 'access.manage'
  | 'plans.billing'
  | 'ai.settings'
  | 'audit.read'
  | 'system.manage';

export type UserStatus = 'active' | 'pending_verification' | 'suspended';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  status?: UserStatus;
  phone?: string;
  bmdc_number?: string;
  org_id?: string;
  mfa_enabled?: boolean;
  created_at: string;
}

export interface FeatureRecord {
  key: FeatureKey;
  description: string;
  category: 'clinical' | 'library' | 'medicine' | 'study' | 'research' | 'patient' | 'feedback' | 'admin';
  created_at: string;
}

export interface RoleFeature {
  id: string;
  role: UserRole;
  feature_key: FeatureKey;
  enabled: boolean;
  daily_limit?: number | null;
  created_at: string;
  updated_at: string;
}

export interface UserFeatureOverride {
  id: string;
  user_id: string;
  feature_key: FeatureKey;
  enabled: boolean;
  daily_limit?: number | null;
  expires_at?: string | null;
  reason?: string | null;
  created_by?: string | null;
  created_at: string;
}

export type SourceType = 'textbook' | 'guideline' | 'journal' | 'drug';

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  year: number;
  license: string;
  url?: string;
  status: 'active' | 'archived';
  created_at: string;
}

export interface Chunk {
  id: string;
  source_id: string;
  source_title?: string;
  source_year?: number;
  page?: number;
  section: string;
  text: string;
  embedding?: number[];
  evidence_level: 'Ia' | 'Ib' | 'IIa' | 'IIb' | 'III' | 'IV';
  hash?: string;
  created_at: string;
}

export interface PatientVitals {
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature_celsius?: number;
  spo2_percent?: number;
}

export interface LabValue {
  name: string;
  value: number | string;
  unit: string;
  reference_range?: string;
}

export interface StructuredPatientInput {
  age: number;
  gender: 'male' | 'female' | 'other';
  weight_kg?: number;
  chief_complaint: string;
  symptoms: string[];
  history_of_present_illness?: string;
  past_medical_history: string[];
  current_medicines: string[];
  allergies: string[];
  vitals: PatientVitals;
  lab_values: LabValue[];
  is_pregnant?: boolean;
  pregnancy_trimester?: 1 | 2 | 3;
  egfr?: number;
  clinical_notes?: string;
}

export type CaseStatus = 
  | 'draft' 
  | 'analyzed' 
  | 'insufficient_evidence' 
  | 'red_flag' 
  | 'confirmed' 
  | 'treated' 
  | 'closed';

export interface PatientCase {
  id: string;
  doctor_id: string;
  patient_code: string;
  status: CaseStatus;
  structured_input: StructuredPatientInput;
  confirmed_diagnosis?: string;
  created_at: string;
  updated_at: string;
}

export interface CaseTurn {
  id: string;
  case_id: string;
  role: 'doctor' | 'system';
  content: {
    type: 'question_answer' | 'doctor_note' | 'status_change';
    question_id?: string;
    question?: string;
    answer?: string;
    note?: string;
  };
  created_at: string;
}

export interface VerifiedClaim {
  text: string;
  chunk_id: string;
  quote: string;
  source_title?: string;
  source_year?: number;
  page?: number;
  verified: boolean;
  verification_status?: 'verified' | 'unverified';
}

export interface DifferentialDiagnosis {
  condition: string;
  condition_bn?: string;
  likelihood_label: 'high' | 'moderate' | 'low';
  supporting_claims: VerifiedClaim[];
  opposing_claims: VerifiedClaim[];
  clinical_rationale: string;
}

export interface MissingInformation {
  id: string;
  type: 'question' | 'exam' | 'test';
  text: string;
  why_it_helps: string;
  which_diagnoses_it_separates: string[];
}

export type ConfidenceScoreLabel = 'high' | 'moderate' | 'low' | 'insufficient';

export interface AnalysisOutput {
  status: 'ok' | 'insufficient_evidence' | 'red_flag';
  confidence: {
    label: ConfidenceScoreLabel;
    score: number; // 0 to 1
    reasoning: string;
  };
  differentials: DifferentialDiagnosis[];
  missing_information: MissingInformation[];
  red_flags: string[];
  summary: string;
}

export interface AnalysisRecord {
  id: string;
  case_id: string;
  round: number;
  output: AnalysisOutput;
  model: string;
  tokens?: number;
  created_at: string;
}

export interface DoseRules {
  standard_adult: string;
  route: 'oral' | 'iv' | 'im' | 'topical' | 'inhalation' | 'sublingual';
  frequency: string;
  duration_days: number;
  max_daily_dose?: string;
  pediatric?: string;
  notes?: string;
}

export interface Contraindications {
  conditions: string[];
  allergies: string[];
  age_min?: number;
  age_max?: number;
}

export interface RenalAdjustment {
  egfr_threshold: number;
  action: 'reduce_dose' | 'avoid' | 'extend_interval';
  adjusted_dose?: string;
  note: string;
}

export interface DrugRecord {
  id: string;
  generic_name: string;
  brand_names?: string[];
  drug_class: string;
  indications: string[];
  dose_rules: DoseRules;
  contraindications: Contraindications;
  pregnancy_category: 'A' | 'B' | 'C' | 'D' | 'X';
  renal_adjustment?: RenalAdjustment;
  source_chunk_id?: string;
  source_title?: string;
}

export interface DrugInteractionRecord {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: 'info' | 'warning' | 'critical';
  note: string;
  source_chunk_id?: string;
}

export type SafetyAlertSeverity = 'info' | 'warning' | 'critical';

export interface SafetyAlert {
  id: string;
  drug_id: string;
  drug_name: string;
  severity: SafetyAlertSeverity;
  type: 'allergy' | 'drug_interaction' | 'contraindication' | 'pregnancy' | 'renal' | 'age' | 'duplicate_therapy';
  title: string;
  description: string;
  acknowledged?: boolean;
}

export interface TreatmentSuggestion {
  drug_id: string;
  generic_name: string;
  drug_class: string;
  rationale: string;
  claim: VerifiedClaim;
  dose_text: string;
  route: string;
  frequency: string;
  duration_days: number;
  monitoring: string[];
  follow_up: string;
}

export interface TreatmentPlan {
  confirmed_diagnosis: string;
  first_line: TreatmentSuggestion[];
  alternatives: TreatmentSuggestion[];
  safety_alerts: SafetyAlert[];
  non_pharmacological: string[];
  doctor_decision?: {
    approved_drug_ids: string[];
    doctor_notes: string;
    finalized: boolean;
    acknowledged_alert_ids: string[];
    signature: string;
    finalized_at: string;
  };
}

export interface AuditLogRecord {
  id: string;
  case_id?: string;
  user_id?: string;
  event: string;
  payload: Record<string, unknown>;
  created_at: string;
}
