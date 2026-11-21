# DocMate AI quality and security audit

**Baseline release verdict: No-go for business or clinical use.** Scope was the local repository and `http://localhost:3000/en/dashboard`. The dashboard responded with HTTP 200 and the bilingual disclaimer smoke test passed. The baseline has no effective case ownership boundary, accepts browser assertions for prescription safety, and displays clinical text beyond its verified quotations. The README describes a hackathon demo. The repository began on an unborn branch with no tracked files or remote.

## Baseline findings

These line numbers refer to the source before remediation. Clinical safety findings are based on code review unless a runtime result is given.

| ID | Severity | Area | Reproduction or inspection | Expected and actual | Evidence | Suggested fix | Baseline status |
|---|---|---|---|---|---|---|---|
| Q01 | P0 | Case authorization | Inspect every case handler and the API middleware matcher | Authenticated physician and matching owner required. Baseline lists, loads and updates cases without an owner filter and accepts anonymous mutations. | `src/app/api/cases/route.ts:7,49`, `src/app/api/cases/[id]/route.ts:6,62`, `src/app/api/cases/[id]/{turns,analyze,treatment,finalize}/route.ts:19,131,29,35` respectively, `src/middleware.ts:8` | Enforce role and ownership at every case boundary. | Confirmed |
| Q02 | P0 | Finalization and print | Trace the case workflow from selected medicines through prescription and report | Server must establish that critical alerts were acknowledged against an actual plan and only print that finalized prescription. Server trusts a browser count, drug IDs and signature. Print renders mutable draft state and calls print without a finalization gate. | `src/app/api/cases/[id]/finalize/route.ts:14–62`, `src/app/[locale]/cases/[id]/page.tsx:266–268`, `src/app/[locale]/cases/[id]/components/ReportTab.tsx:46–76` | Check current patient and formulary records on the server. Record acknowledgments and snapshot the prescription atomically. Print only the persisted snapshot. | Confirmed |
| Q03 | P0 | Grounding | Inspect a fabricated assertion paired with an authentic quotation, and trace persisted output to the UI | Claims must be grounded and verified before display. The verifier checks substring occurrence only, then marks arbitrary accompanying prose as verified. Differential name, rationale, confidence, red flags and summary bypass verification. Ask returns its free-text answer even with zero verified citations. | `src/lib/verifier.ts:3–19,35–53`, `src/app/api/cases/[id]/analyze/route.ts:500–552`, `src/app/api/ask/route.ts:133–157`, `src/app/[locale]/cases/[id]/components/DifferentialsTab.tsx:204–260` | Use a fail-closed output contract. Do not pass unverified generated clinical prose through to the UI. | Confirmed |
| Q04 | P0 | Treatment evidence | Trace a candidate with no matching guideline for its drug | A recommendation requires specific evidence. The route marks arbitrary text from the first hit or an invented guideline as verified and emits uncited monitoring and follow-up. Adult rules are shown regardless of applicability. | `src/app/api/cases/[id]/treatment/route.ts:93–169,181–190`, `scripts/seed.ts:811–829` | Require curated indications, patient applicability and specific source-linked evidence. Suppress unsupported treatments. | Confirmed |
| Q05 | P1 | Abstention and injection | Assess P-103 fixture and run the unrelated retrieval sample below | Insufficient or unrelated evidence should yield abstention with concrete missing information. P-103 has three symptoms and misses the two-symptom guard. Unrelated queries still receive vector hits and the offline Ask path treats any hit as an answer. Prompt separation exists, but does not enforce claim support. | `scripts/seed.ts:787–799`, `src/app/api/cases/[id]/analyze/route.ts:169–207,312–358,426–491`, `src/app/api/ask/route.ts:48–68,112–129`, `src/lib/retrieval.ts:54–78` | Abstain deterministically for insufficient inputs or relevance. Treat documents and patient text as untrusted. Exercise adversarial fixtures. | Confirmed |
| Q06 | P1 | Identity and secrets | Read the signer, login and demo setup | A deployment-specific secret, current user/role and deliberately provisioned accounts are required. A known fallback signs sessions, cookie roles are trusted, password storage is fast HMAC, and sample credentials are in source. | `src/lib/auth.ts:8–25,38–68,88–129`, `src/app/api/auth/login/route.ts:24–36` | Require a high-entropy secret, recheck identity against the database, separate demo provisioning, and migrate password storage. | Confirmed |
| Q07 | P1 | Validation, abuse and audit | Inventory request schemas and audit writes | Inputs should be validated/bounded; expensive and auth endpoints throttled; mutations audited with actor and outcome. Request bodies generally go directly to handlers and no limiter was found. Some writes are separate from audit inserts and errors expose raw messages. | `src/app/api/auth/login/route.ts:8–41`, `src/app/api/ask/route.ts:24–33,159–161`, `src/app/api/cases/[id]/route.ts:62–86`, `src/app/api/cases/[id]/turns/route.ts:14–66`, `src/app/api/library/sources/route.ts:35–82` | Bound requests, add route schemas and identity-based throttling, and couple security-sensitive writes with audit records. | Confirmed |
| Q08 | P1 | Bootstrap and retrieval | Follow README and repeat ingest on clean schema | Template should ship, prerequisites should create schema, seed should create users, and ingestion should be idempotent including source and full-text metadata. Environment template is ignored, schema/extension setup absent, users absent from seed, duplicate sources inserted, and the full-text column never populated. | `.gitignore:34–35`, `README.md:26–86`, `src/db/schema.ts:19–43`, `scripts/ingest.ts:141–186`, `scripts/seed.ts:804–863` | Publish sanitized template, document setup, provision demo users deliberately, populate search index and make source/chunk writes atomic and idempotent. | Confirmed |
| Q09 | P1 | Safety coverage | Compare safety engine, intake fields, and data provenance | All supported patient and regimen risks need structured input and reviewed rule coverage. Duplicate therapy is absent from the engine and pregnancy/renal checks are limited. Drug rows are seeded without source chunk bindings. | `src/lib/safety-engine.ts:94–136,140–203,205–262`, `src/db/schema.ts:74–94`, `scripts/seed.ts:811–841` | Add deterministic duplicate checking, capture structured qualifiers, validate formulary and clinical scope before enabling prescription workflows. | Confirmed |
| Q10 | P2 | Localization and accessibility | Open Bangla locale and inspect headings, browser language and report | Page language, dates and all visible strings should follow the locale. Root HTML is English, client dates omit the locale, and clinical/report UI contains hardcoded English. | `src/app/layout.tsx:15`, `src/app/[locale]/cases/page.tsx:193`, `src/app/[locale]/cases/[id]/components/ReportTab.tsx:70–165`, `e2e/smoke.spec.ts:20` | Set document language server-side and localize visible UI and formatting. | Confirmed |
| Q11 | P2 | Overlay and feedback | Compare the overlay components with the actual call sites | All prescribed mobile and desktop interactions should exist. Responsive sidebar, citation preview, evidence sheet and dialogs exist, but mobile Drawer, case history and drug detail Sheets are absent. Search palette navigates static routes and does not query cases or library. | `src/components/shared/{AppShell,GlobalSearchCommand,CitationChip,EvidenceSheet}.tsx:117,38,68,80` respectively, `src/app/[locale]/library/page.tsx:144,331` | Fill missing workflows and cover keyboard focus and responsive states. | Confirmed |
| Q12 | P2 | Build, telemetry and caching | Run build and inspect model and cache usage | Default production build and actual usage measurement should work. Turbopack failed starting its CSS worker here, webpack compiled. Stored token count is the constant 450 and caches lack size bounds. | `next.config.ts:5–12`, `src/lib/retrieval.ts:14–17,61,178`, `src/app/api/cases/[id]/analyze/route.ts:555–562` | Resolve build portability, bound caches and record actual provider usage and costs. | Confirmed |
| Q13 | P2 | Clinical library provenance and privacy | Inspect fixtures, intake and ingestion | Synthetic-only input and verifiable source provenance required. Fixtures are coded, while intake permits arbitrary text and ingestion assigns default date/evidence/license and sequential pseudo-pages. Clinical source authenticity and rights were unverified. | `src/app/api/cases/route.ts:52–69`, `scripts/ingest.ts:56–104`, `data/library/` | Constrain demo admission and establish source/edition/page provenance plus privacy controls. | Confirmed |
| Q14 | P3 | Tooling warnings | Run baseline lint, build and Vitest | Commands should be warning-free. ESLint emitted 14 unused-symbol warnings, Next flagged middleware deprecation and Vitest flagged upcoming native config loading. | See command log. | Clean unused symbols and migrate config with separate validation. | Confirmed |

## AGENTS.md traceability

Pass indicates direct evidence within the stated scope. Partial indicates incomplete implementation or runtime verification.

| Requirement | Baseline | Evidence |
|---|---|---|
| 1.1 Closed library and exact prompt | Fail | No search tools were supplied to either chat call. Wording differs and outside knowledge can survive in generated prose. Analyze and Ask prompts at lines 185 and 61, Q03. |
| 1.2 Every clinical claim cited | Fail | Q03, Q04. |
| 1.3 Deterministic whitespace quote verification and suppression | Fail | `src/lib/verifier.ts:3–19,42–53` also folds case and punctuation, and downstream fields bypass it. |
| 1.4 Abstention with missing information | Fail | Q05. |
| 1.5 Physician authority and persistent bilingual disclaimer | Partial | `AppShell.tsx:285`, login page line 228 and report lines 108–116. Bilingual smoke passed. Authority enforcement fails, Q01–Q02. |
| 1.6 Deterministic drugs and safety | Partial | Treatment route lines 155–158 are sourced from structured rules without an LLM. Applicability, citations and decision enforcement fail, Q02/Q04/Q09. |
| 1.7 Untrusted inputs | Fail | Prompts label excerpts as data, but case text is interpolated into the same user message and downstream checks do not bind the claim to the quote. Q03/Q05. |
| 1.8 Synthetic only and secrets | Partial | `scripts/seed.ts:845–859`; `.gitignore:35`; no tracked history. Hardcoded fallback and arbitrary clinical text, Q06/Q13. |
| 1.9 No clinical accuracy claims | Pass | README section 7 refers to translation key parity. No 100% clinical-accuracy claim found in reviewed sources. |
| 2.1 shadcn, tokens, themes | Partial | `components.json`, `src/components/ui/sidebar.tsx`, `src/app/globals.css`, `ThemeToggle.tsx`. CLI provenance unestablished and raw colour utilities occur in report and dashboard. |
| 2.2 Sidebar | Partial | `AppShell.tsx:114–159` and `src/components/ui/sidebar.tsx` implement icon collapse, active state and mobile Sheet. Focus and breakpoint verification pending baseline. |
| 2.2 Sheet | Partial | `EvidenceSheet.tsx:80–154`, library page lines 144–240. Drug and case history Sheets missing. |
| 2.2 Dialog and AlertDialog | Partial | Case page lines 469–491 uses separate confirmation and finalization components. Dedicated clinical acknowledgment dialog and focus behavior unverified. |
| 2.2 Drawer | Fail | `src/components/ui/drawer.tsx` exists without a mobile filter or preview call site. |
| 2.2 Popover/HoverCard | Pass | `CitationChip.tsx:68–92` integrates quote preview and evidence action. |
| 2.2 Accordion | Pass | `DifferentialsTab.tsx:107,194–234`. |
| 2.2 Tabs | Pass | Case workspace page lines 50–54 and 82–87 sync the query parameter. |
| 2.2 Command | Partial | `GlobalSearchCommand.tsx:16–81` handles keyboard and navigation. No real case/source search. |
| 2.2 Tooltip | Partial | `AppShell.tsx:159–176` includes truncated labels without a full-text tooltip in all states. |
| 2.2 Resizable | Pass | Case workspace page renders the resizable desktop group at lines 356–468. |
| 2.2 Sonner | Partial | `src/components/ui/sonner.tsx` and `SafetyAlertItem.tsx:16–96`. Critical alerts use inline controls. Full notification inventory unverified. |
| 2.3 Loading, empty and retry | Partial | `LoadingState.tsx:80–87` and shared EmptyState/ErrorState exist. Uniform coverage of pages and sublists unverified. |
| 2.3 Insufficient evidence | Partial | `DifferentialsTab.tsx:145–186` and `MissingInfoTab.tsx` support the state. Baseline decision contract fails Q05. |
| 2.3 Safety severities and acknowledgment | Partial | `SafetyAlertItem.tsx:16–96` uses icon/labels, finalization does not enforce the browser state, Q02. |
| 2.3 Confidence | Partial | `ConfidenceBadge.tsx` displays labels. Baseline score and reasoning are model-controlled, Q03. |
| 2.4 Clinical palette, danger colours, 44px targets and grid | Partial | `src/app/globals.css:1–122` and `src/components/ui/button.tsx:13–32`; compact buttons and raw colour classes fail uniform requirements. |
| 3.1 Routing and cookie | Partial | `src/i18n/routing.ts:3–8`, `LanguageSwitcher.tsx:21`, `src/app/page.tsx`. Cookie switch code present. Browser persistence pending. |
| 3.2 JSON parity, all strings translated | Partial | `tests/i18n-parity.test.ts` passed. Q10 demonstrates hardcoded visible strings. |
| 3.3 Bengali typography and wrapping | Partial | `src/app/fonts.ts`, `src/app/globals.css:122`; root document language and truncate defects in Q10/Q11. |
| 3.4 Locale to AI, bilingual terminology, original quotes and formats | Partial | Analyze route lines 128,188–189 and Ask route lines 26,64–65 request locale and source language. Output quality unverified and date/number handling is incomplete. |

## README traceability

| README section | Baseline | Evidence |
|---|---|---|
| Disclaimer and section 1 safety promises | Fail | Bilingual disclaimer smoke passed. Q01–Q06 cover safety promises, Q10 covers localization. |
| Section 2 prerequisites, install, ingest, seed, build/start and Bangla routing | Fail | Node 20 and pnpm 9 available and clean frozen install passed. Missing tracked template and undocumented DB initialization, missing user provisioning, default build fails here. Q08, Q12. |
| Section 3 seeded roles and credentials | Fail | `scripts/seed.ts:804–863` seeds no users. `src/lib/auth.ts:89–113` uses a different password. README student read access conflicts with the requested student case restriction, which governs this audit. No researcher audit or admin formulary workflow demonstrated. |
| Section 4 case fixtures and behaviors | Partial | `scripts/seed.ts:735–801` and seed run confirm 3 fixtures. P-103 abstention predicate misses the fixture. CAP/ACS evidence and complete clinical workflow unverified. |
| Section 5 architecture | Partial | Intake, analysis, turns, treatment and report routes/components exist. Verification, retrieval, finalization and audit promises fail Q01–Q09. |
| Section 6 library additions | Partial | Markdown/text and chunk hash supported. Split is by words, sources duplicate, embeddings are per chunk and full-text vector is missing. `scripts/ingest.ts:107–186`. |
| Section 7 checks | Partial | 28 baseline unit tests passed, 2 of 3 smoke tests failed. Lint/typecheck pass with lint warnings, default build failed, webpack fallback used. |
| Section 8 demo, license and standards | Partial | Synthetic fixtures only in seed. Source license/clinical standards claims and real-world readiness remain unverified. Q13. |

## Baseline command log

| Command | Output summary |
|---|---|
| `node -v`, `pnpm -v`, `git status -sb`, `git log -3 --oneline`, `git remote` | v20.20.2 and 9.15.4. Unborn master, no commits and no remotes. |
| `pnpm install --frozen-lockfile --offline` | Existing node_modules reinstall prompt. No install verified by this attempt. |
| `mkdir -p /tmp/docmate-qa-install && cp package.json pnpm-lock.yaml /tmp/docmate-qa-install/ && pnpm --dir /tmp/docmate-qa-install install --frozen-lockfile` | Restricted DNS caused ENOTFOUND warnings. |
| `pnpm --dir /tmp/docmate-qa-install install --frozen-lockfile --fetch-retries=0` | Escalated retry passed using cached artifacts. 629 resolved and installed. |
| `pnpm run lint` | Exit 0, no errors and 14 unused-symbol warnings. Intake 1, analyze 4, treatment 5, cases collection 3, safety engine 1. |
| `pnpm run typecheck` | Exit 0, no diagnostics. |
| `pnpm test` | 3 files and 28 tests passed. Native config loader warning in vitest.config.ts. |
| `pnpm run build` | Both standard and escalated attempts failed with Turbopack CSS loader unable to bind a port, EPERM. Next flagged the middleware convention. |
| `pnpm run build --webpack` | Compiled and checked TypeScript, generated 10 static pages. Middleware warning. See follow-up log for exit status. |
| `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\\n' http://localhost:3000/en/dashboard` | Sandboxed curl failed to connect. Escalated local curl received HTTP 200. |
| `pnpm run dev` | Port 3000 occupied, dev process chose 3001 and reported ready. Started only for QA. |
| `pnpm run test:e2e --output /tmp/docmate-qa-smoke` | 1 pass and 2 failures. Both credential scenarios timed out on login with a trailing question mark. Bilingual disclaimer passed. Material inspected showed HTML lang=en on Bangla login. |
| `git ls-files --error-unmatch .env.example`, `git check-ignore .env .env.example` | Template exists in local checkout but is ignored and untracked. No clone could be repeated without a remote. |
| `pg_isready`, `pg_isready -h localhost` | Local default socket and 5432 yielded no response in restricted execution. |
| `pnpm run ingest`, `pnpm run seed` | As written, sandbox blocked the tsx IPC listener with EPERM. The README omits schema setup independently of this environment error. |
| `initdb -D /tmp/docmate-qa-pg -A trust --no-locale` | Sandbox denied PostgreSQL shared memory. |
| `initdb -D /tmp/docmate-qa-pg -A trust --no-locale -E UTF8 && pg_ctl -D /tmp/docmate-qa-pg -l /tmp/docmate-qa-pg.log -o '-p 55439 -h 127.0.0.1 -k /tmp/docmate-qa-pg' -w start` | Isolated PostgreSQL started with local-only listener. |
| `DATABASE_URL=postgresql://127.0.0.1:55439/postgres pnpm exec drizzle-kit push --force` | Printed error 42704, type vector does not exist, despite exit 0. |
| `DATABASE_URL=postgresql://127.0.0.1:55439/postgres; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION IF NOT EXISTS vector' && export DATABASE_URL && pnpm exec drizzle-kit push --force` | Extension created and schema applied. |
| `export DATABASE_URL=postgresql://127.0.0.1:55439/postgres OPENAI_API_KEY=; pnpm run ingest && pnpm run seed && pnpm run ingest` | Offline only. First run 4 files and 16 chunks. Seed logged 25 drugs, 11 interactions and 3 synthetic cases. Second ingest skipped 16 hashes. Automatic review rejected the first combined command with embedding credentials potentially available, because external transmission of internal passages was not authorized. The offline retry explicitly emptied the key. |
| `DATABASE_URL=postgresql://127.0.0.1:55439/postgres OPENAI_API_KEY= node --import tsx -e 'const {hybridRetrieve}=require("./src/lib/retrieval.ts"); (async()=>{for (const q of ["pneumonia","amoxicillin","chest pain","troponin","dengue","platelets","hypertension","amlodipine","ডেঙ্গু","quantum entanglement"]) { const [c]=await hybridRetrieve([q]); console.log(q, "\|", c?.section, "\|", c?.textRank ?? "-", "\|", c?.vectorScore?.toFixed(3) ?? "-"); } process.exit(0);})().catch(e=>{console.error(e.message);process.exit(1);});'` | Actual top results below. All ten lacked a text rank. |
| `pnpm --dir /tmp/docmate-qa-install add axe-core lighthouse --fetch-retries=0` | Tool setup started in temporary directory. See follow-up log. |

### Baseline retrieval sample

| Query | Top section | Vector score |
|---|---|---:|
| pneumonia | Section 5: Monitoring, Escalation, and Red-Flag Symptoms | 0.659 |
| amoxicillin | Section 4: Non-Cardiac Differential Diagnoses & Differentiation | 0.651 |
| chest pain | Section 3: Emergency Pharmacological Triage Regimen | 0.621 |
| troponin | Section 2: First-Line Antihypertensive Drug Classes | 0.729 |
| dengue | Section 4: Fluid Management Protocol & Outpatient Monitoring | 0.806 |
| platelets | Section 4: Alternative Regimens & Penicillin Hypersensitivity | 0.659 |
| hypertension | Section 4: Fluid Management Protocol & Outpatient Monitoring | 0.704 |
| amlodipine | Section 3: First-Line Empirical Antimicrobial Regimens | 0.624 |
| ডেঙ্গু | Section 3: Emergency Pharmacological Triage Regimen | 0.644 |
| quantum entanglement | Section 1: Blood Pressure Classification & Cardiovascular Risk | 0.665 |

## Coverage gaps and regression checklist

- Keep patient fixtures synthetic. Check anonymous, student, researcher, admin, owner and a different doctor on collection and detail endpoints. Check session invalidation and ensure mutation logs include the physician and case.
- Assert that fake claims, unknown chunk IDs, altered quotes and instruction-bearing excerpts cannot become clinical recommendations. Exercise verified source quotes, low relevance, conflicting sources, missing inputs and P-103 in both locales.
- Test all safety rule categories, duplicate therapy and selected-drug interactions. Require server acknowledgment before finalization and verify print from persisted state after refresh.
- Test authenticated intake through report, student restrictions, admin sources, search, and both relevant and unrelated Ask requests. Run overlays with keyboard at 390, 768 and 1280 px in bn/en and light/dark. Include focus restoration, horizontal overflow, layout stability, loading/error recovery and axe.
- Run the README from a clean clone and fresh pgvector schema. Test repeated and concurrent ingest, source metadata, retrieval relevance and source version changes. Test vendor-model behavior and cost only in an approved synthetic-data environment.
- Run frozen install, lint, typecheck, build, Vitest, Playwright, accessibility and Lighthouse. Record route bundle transfer and actual input/output usage. No live provider token or cost average exists from this offline baseline. The stored constant 450 is not measured usage.
