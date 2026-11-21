# docs/ACCESS.md — DocMate AI Access Control & Feature Matrix

This document defines the formal access control rules, dynamic feature permissions, data-scope isolation policies, and verification gates for DocMate AI.

---

## 1. Six User Roles

| Role | Target Persona | Scope of Use |
| :--- | :--- | :--- |
| **`super_admin`** | Executive hospital/system administrator | Platform governance, access matrix toggling, library approval, user verification, system audit. **No clinical access by default**; break-glass required. |
| **`doctor`** | Licensed medical practitioner (BMDC registered) | Patient intake, clinical observation, evidence-backed AI assistance, prescribing, safety override acknowledgments. |
| **`student`** | Medical trainee / intern | Study tools, synthetic virtual patient practice, cited library Q&A, chapter quizzes, personal study notes. **Zero access to real patient records.** |
| **`researcher`** | Clinical epidemiologist / academic | Guideline search, side-by-side evidence comparison, collections, RIS/BibTeX citation export. **Zero access to real patient records.** |
| **`patient`** | Individual seeking or receiving medical care | Patient portal: shared prescriptions, reminder schedule, report uploads, pre-visit questionnaires, consent management. **Zero AI diagnosis or dose advice.** |
| **`medicine_controller`** | Regulatory pharmacologist / formulary officer | Medicine catalog management (brands, generics, DGDA registration, dose bounds, interactions), versioning, safety notices. **Zero access to real patient records.** |

---

## 2. Dynamic Feature Access Matrix

Access is evaluated dynamically via the server-side function `canUse(user, featureKey)` rather than hardcoded role strings.

| Feature Key | `super_admin` | `doctor` | `student` | `researcher` | `patient` | `medicine_controller` | Description |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`patients.manage`** | **BG** | **Y** | - | - | - | - | Create/edit patient profiles, clinical visits, encounters |
| **`ai.analyze`** | - | **Y** | - | - | - | - | Differential diagnosis analysis & follow-up questions |
| **`ai.treatment`** | - | **Y** | - | - | - | - | Guideline-recommended treatments & dosing rules |
| **`prescription.create`** | - | **Y** | - | - | - | - | Generate, sign, print, and share prescriptions |
| **`library.ask`** | **Y** | **Y** | **Y** | **Y** | - | **Y** | Q&A with verbatim citations over internal library |
| **`library.browse`** | **Y** | **Y** | **Y** | **Y** | - | **Y** | Read approved textbooks and clinical protocols |
| **`library.manage`** | **Y** | - | - | - | - | - | Ingest, edit, approve, and retire library sources |
| **`medicine.search`** | **Y** | **Y** | **Y** | **Y** | - | **Y** | Search generic medicines, Bangladeshi brands, dosage forms |
| **`medicine.interactions`** | **Y** | **Y** | **Y** | **Y** | - | **Y** | Multi-drug interaction screening engine |
| **`medicine.manage`** | **Y** | - | - | - | - | **Y** | Add/edit drugs, brand mapping, DGDA registration, dose rules |
| **`medicine.notices`** | **Y** | **read** | **read** | **read** | **own** | **Y** | Broadcast/read regulatory safety notices and recalls |
| **`study.tools`** | - | - | **Y** | - | - | - | Virtual patient cases, chapter flashcards, quizzes, notes |
| **`research.tools`** | - | - | - | **Y** | - | - | Cross-guideline comparison, collections, RIS/BibTeX export |
| **`patient.portal`** | - | - | - | - | **own** | - | Patient self-service portal, schedule, report upload |
| **`feedback.send`** | **Y** | **Y** | **Y** | **Y** | **Y** | **Y** | Submit feedback or report clinical discrepancies |
| **`feedback.review`** | **Y** | - | - | - | - | **drug** | Review feedback (controller reviews drug feedback only) |
| **`users.manage`** | **Y** | - | - | - | - | - | Approve sign-ups, suspend accounts, session revocation |
| **`access.manage`** | **Y** | - | - | - | - | - | Configure feature matrix toggles and per-user overrides |
| **`plans.billing`** | **Y** | **view** | **view** | **view** | - | - | Subscription tiers, payment adapters, invoices |
| **`ai.settings`** | **Y** | **view** | **view** | **view** | - | - | Prompt versions, model selection, abstain thresholds |
| **`audit.read`** | **Y** | - | - | - | - | - | Read cryptographic hash-chain audit ledger |
| **`system.manage`** | **Y** | - | - | - | - | - | Maintenance mode, backups, kill switches |

*Legend*:
- **`Y`**: Fully enabled.
- **`-`**: Denied (returns HTTP 403 Forbidden).
- **`BG`**: Break-Glass only (requires written clinical emergency rationale, audited, time-limited).
- **`own`**: Access restricted strictly to own personal records.
- **`read`**: Read-only access to published bulletins.
- **`view`**: View plan status or public settings only.
- **`drug`**: Review drug-related feedback reports only.

---

## 3. Strict Server-Side Data-Scope Policies

These data-scope rules are **hardcoded invariants** enforced on the server. No toggle or database override can bypass them:

1. **Physician Isolation**: A doctor can only read and mutate patients, encounters, and prescriptions that the doctor created.
2. **Patient Isolation**: A patient can only view their own personal profile and prescriptions explicitly shared by a linked doctor.
3. **PHI Wall**: `student`, `researcher`, and `medicine_controller` accounts are physically blocked from accessing any patient record or encounter table (`HTTP 403 Forbidden`).
4. **Super Admin Clinical Exclusion & Break-Glass**:
   - `super_admin` has zero default access to clinical records, patient encounters, or diagnostic notes.
   - In rare system emergencies or legal audits, a super admin may invoke **Break-Glass**:
     - Requires a formal written justification (`reason`).
     - Session is time-bounded (maximum 60 minutes).
     - Every read and action during break-glass is flagged in the audit log with `event: "break_glass.invoked"`.
5. **Account Organization Scoping**: All clinical tables feature an optional `org_id` column ready for multi-hospital deployments. Currently, accounts default to independent personal clinical scopes.

---

## 4. Professional Verification Workflows

1. **Doctor Registration**:
   - Requires BMDC registration number and medical certificate document upload.
   - Account status is `pending_verification`.
   - `patients.manage`, `ai.analyze`, and `prescription.create` are disabled until a `super_admin` approves the verification record.
2. **Student Registration**:
   - Requires institute name, student ID number, and institutional email domain.
   - Automatic approval if email matches a whitelist in `systemSettings`; otherwise requires `super_admin` review.
3. **Researcher Registration**:
   - Requires institutional email or ORCID identifier.
   - Approved by `super_admin`.
4. **Medicine Controller**:
   - Created exclusively by invitation from a `super_admin`.
5. **Patient Registration**:
   - Self-registration via mobile phone number + SMS OTP verification. No admin approval required.
   - Linked to doctors through unique invite codes or OTP match upon explicit patient consent (*"আমি এই ডাক্তারকে অনুমতি দিচ্ছি"*).

---

## 5. Security & Audit Invariants

- **Central Enforcement**: `canUse()` is invoked in every API route handler, server action, and file export endpoint. UI hiding is strictly for user experience; the server governs authorization.
- **Audit Logging of Permission Changes**: Any modification to role features or user overrides by a super admin records before and after states in the tamper-evident hash-chained `audit_logs` table.
- **Instant Invalidation**: Permission cache invalidation occurs immediately on update.
