# DocMate AI (ডকমেট এআই)
### Clinical Decision Support Assistant with Verbatim Citation Verification & Deterministic Drug Safety

> **Important Clinical Disclaimer**:
> **Clinical decision support only. Not a substitute for professional judgement.**
> *(শুধুমাত্র ক্লিনিকাল সিদ্ধান্ত সহায়তা। পেশাদার মূল্যায়নের বিকল্প নয়।)*

---

## 1. Demo scope

DocMate AI is a synthetic-data demonstration. The clinical assessment endpoint currently abstains and exposes follow-up questions for physician review. Ask searches indexed text and shows exact source excerpts. Automated treatment, prescription finalization and prescription printing are disabled pending verification of the clinical evidence and authorization workflow. See [QA_REPORT.md](QA_REPORT.md) for the release assessment.

## 2. Quickstart

Use Node.js 20.19 or newer in the 20.x series, pnpm 9 or newer, and PostgreSQL with pgvector. Docker Compose can provide the documented local database.

```bash
cp .env.example .env
openssl rand -hex 32
docker compose up -d postgres
pnpm install --frozen-lockfile
```

Set `AUTH_SECRET` in `.env` to the generated value. The example enables demo logins for this local synthetic environment. Keep the embedding API key empty for offline ingestion. Copy the database URL from your local configuration if it differs from the Docker Compose default.

```bash
export DATABASE_URL='postgresql://docmate:docmate_dev_password@localhost:5432/docmate'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector'
pnpm exec drizzle-kit push
pnpm run ingest
pnpm run seed
pnpm run build
pnpm start -p 3000
```

Open `http://localhost:3000`. In a fresh session the default locale is Bangla. For hot reload, run `pnpm run dev --webpack` in place of the production build and start commands.

> **Production Deployment**: For production Docker containerization, VPS (PM2 + Nginx), cloud setup (Vercel + Supabase), and clinical safety configuration, consult the **[Production Deployment Guide (DEPLOYMENT.md)](DEPLOYMENT.md)**.

## 3. Seeded Demo Accounts

You can sign in with any of the pre-seeded clinical personas:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Doctor (Physician)** | `doctor@docmate.ai` | `demo123` | Patient intake, clinical history, case workspace, prescribing |
| **Student** | `student@docmate.ai` | `demo123` | Study practice, virtual patient cases, cited library Q&A |
| **Researcher** | `researcher@docmate.ai` | `demo123` | Guideline search, cross-evidence comparison, citation exports |
| **Medicine Controller** | `controller@docmate.ai`| `demo123` | DGDA medicine formulary, brand pricing, interaction checks |
| **Admin** | `admin@docmate.ai` | `demo123` | Access matrix, patient governance, duplicate merges, audit ledger |
| **Patient (Phone + OTP)**| Phone: `01700000001` | OTP: `123456` | Multi-profile portal, daily medicine routine, access control |

For detailed workflow documentation:
- **[Patient-Centred Architecture & Workflows (PATIENT_FLOW.md)](docs/PATIENT_FLOW.md)**
- **[Access Control & Dynamic Feature Matrix (ACCESS.md)](docs/ACCESS.md)**
- **[Upgrade Analysis & Data Migration (ANALYSIS_PATIENT_UPGRADE.md)](ANALYSIS_PATIENT_UPGRADE.md)**

---

## 4. Seeded synthetic patient cases

The demo physician owns three fixtures: `P-101` (fever and cough), `P-102` (chest pain), and `P-103` (vague malaise without recorded vitals). Use them only to exercise the application. Automated clinical assessment currently returns `insufficient_evidence`.

## 5. System architecture

The Next.js workspace stores cases, physician follow-up turns and audit events in PostgreSQL. Case API reads and writes are scoped to the authenticated physician. Library ingestion stores source metadata, chunks and full-text vectors. The active Ask route searches text and displays verbatim, verified source excerpts. Optional pgvector embeddings are available to the offline evaluation harness when provider access is configured.

## 6. How to Add New Medical Guidelines to the Library

To expand the internal knowledge base with real clinical textbooks or national protocols:

1. Place your guideline Markdown files (`.md`) or text files into `data/library/`.
2. Format headings using standard Markdown (`# Title`, `## Section 1: ...`).
3. Run the ingestion script:
   ```bash
   pnpm run ingest
   ```
   The script splits files by section into chunks of up to 500 whitespace-separated words with 10% overlap and populates the PostgreSQL full-text index. Unchanged chunks are reused by SHA-256 hash. A configured embedding key sends library text to the provider during ingestion.

---

## 7. Testing & Verification

### Running Vitest Unit Tests
Tests citation whitespace normalization, verbatim matching, dropping unverified claims, drug safety engine rules (allergies, interactions, pregnancy, eGFR, age), and 100% i18n key parity:
```bash
pnpm test
```

### Running Playwright Smoke E2E Tests
Tests demo login, case workspace rendering, and bilingual disclaimer persistence:
```bash
pnpm run test:e2e
```

### Code Quality & Compilation
```bash
pnpm run lint
pnpm run typecheck
pnpm run build
```

---

## 8. License & Standards
Built for hackathon demonstration purposes. Use only synthetic patient data. Clinical and business deployment remain out of scope.
