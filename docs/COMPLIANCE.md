# DocMate AI — Clinical Governance & Regulatory Compliance

## 1. Regulatory Context & Framework
DocMate AI is a Clinical Decision Support SaaS engineered to serve clinicians, hospitals, and healthcare authorities in the People's Republic of Bangladesh. This document details the technical and operational compliance architecture aligning with:
1. **Bangladesh Data Protection Act / Ordinance** (Personal Data Protection Principles).
2. **Bangladesh Medical & Dental Council (BMDC)** Code of Medical Ethics and Prescription Standards.
3. **Directorate General of Drug Administration (DGDA)** National Drug Policy and Pharmacovigilance Recalls.
4. **Directorate General of Health Services (DGHS)** Clinical Practice Guidelines and Digital Health Standards.

---

## 2. Bangladesh Data Protection Compliance

| Principle | Technical Implementation | Proof in Codebase |
| :--- | :--- | :--- |
| **Data Localization** | All database instances, audit chains, and patient identifiers reside within national boundary hosting configurations. External third-party cloud data transmission is prohibited without explicit authorization. | `docker-compose.prod.yml`, `.env` |
| **Explicit Consent** | Patient health data is processed only after verified consent. Every grant or revocation is recorded in an immutable ledger with timestamps and client IP. | `src/app/api/patient/consent/route.ts`, `patient_consent_logs` |
| **Right to Revoke** | Patients can revoke digital sharing consent at any time from their personal portal with immediate propagation. | `src/app/[locale]/portal/page.tsx` |
| **Pre-LLM De-Identification** | Identifiable patient health information (names, Bangladeshi mobile numbers `+880...`, National ID numbers `NID`, BMDC numbers, emails) are stripped prior to clinical reasoning context assembly. | `src/lib/deidentify.ts`, `tests/deidentify.test.ts` |
| **At-Rest & In-Transit Encryption** | Clinical visit notes, symptoms, and diagnoses are encrypted using AES-256-GCM authenticated cipher with unique initialization vectors (`iv`) and auth tags. | `src/lib/encryption.ts`, `tests/encryption.test.ts` |
| **Tamper-Evident Audit Trail** | Every security-relevant event, authentication, permission change, and clinical finalization is chained sequentially using SHA-256 cryptographic hashes with advisory transaction locks. | `src/lib/audit.ts`, `tests/audit.test.ts` |

---

## 3. BMDC Code of Medical Ethics & Prescription Architecture

1. **Doctor Retains Final Authority ("Doctor Decides, AI Suggests")**:
   - The AI assistant never executes autonomous medical decisions, diagnoses, or prescriptions.
   - Persistent bilingual clinical disclaimer on every screen:
     - *Bangla*: "ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়। চিকিৎসকই চূড়ান্ত সিদ্ধান্ত নেন।"
     - *English*: "Clinical decision support only. Not a substitute for professional judgement. The doctor decides."
2. **BMDC Prescription Pad Standards**:
   - Prescriptions capture doctor's full name, BMDC registration number, qualifications, clinic address, and standardized dosage instructions in the `১+০+১` (Morning+Noon+Night) format with meal relation and duration.
   - Finalized prescriptions generate a cryptographic digital signature and public QR verification portal (`/[locale]/verify/rx/[hash]`).
   - Re-computation of safety checks occurs strictly on the server against persisted records; finalized prescriptions are immutable.

---

## 4. DGDA National Formulary & Pharmacovigilance Recalls

1. **Deterministic Dosage & Contraindication Checks**:
   - All drug doses, frequencies, routes, contraindications, and interaction alerts originate from structured `drugs` database tables and deterministic TypeScript code—never from generative LLM text.
2. **Two-Person Review Governance**:
   - Formulations and brand additions proposed by one DGDA controller require approval by a separate controller before appearing in clinical prescribing feeds.
3. **Critical Recall Safety Stops**:
   - Active DGDA safety notices broadcast recall alerts that instantly halt prescription finalization across the entire platform.

---

## 5. Strict Role Isolation Architecture

```
                    ┌───────────────────────────────────┐
                    │     DocMate AI Platform Core      │
                    └───────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         │                            │                            │
         ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Doctor Persona  │         │ Patient Persona  │         │ Student/Research │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ • Own cases only │         │ • Personal portal│         │ • Closed library │
│ • BMDC pad view  │         │ • Schedules/docs │         │ • Zero PHI access│
│ • Full clinical  │         │ • Consent manage │         │ • Synthetic sand-│
│   decision tools │         │ • Zero AI Rx/Dx  │         │   box simulations│
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

- **Patient Isolation**: Patients never receive direct AI diagnoses or unmediated treatment plans.
- **Student & Researcher Isolation**: Medical trainees and research investigators operate exclusively in closed-library mode on synthetic patient simulations with zero access to real patient records.
- **Doctor Scope Boundary**: Clinicians can view only cases and visits they personally created.

---

## 6. Closed-Library Guarantee (Zero Web / Zero Hallucination)

1. **Strict Closed Library**:
   - The assistant has zero web connectivity. Clinical reasoning uses only retrieved passages from the internal, approved medical library.
2. **Verbatim Citation Requirement**:
   - Every claim is bound to a specific `chunk_id` with a verbatim quote verified deterministically by whitespace-normalized string comparison (`src/lib/verifier.ts`).
3. **Abstention by Design**:
   - When evidence is conflicting, insufficient, or clinical facts are missing, the system declares status `insufficient_evidence` alongside actionable follow-up questions.
