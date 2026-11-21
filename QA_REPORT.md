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

## Remediation and final verdict

**No-go for business or clinical deployment.** The tested revision supports a private, synthetic-data demo. It records physician-owned cases and follow-ups and retrieves verbatim source excerpts. Automated analysis abstains, and the release has no verified treatment, acknowledged prescription finalization, or official prescription printing path. Clinical source provenance, formulary validation, production privacy and operational controls remain open. The initial unsafe output paths were contained in separate commits. Containment does not certify the intended clinical features.

The checkout was initially untracked. The pre-fix checkpoint is `767168a`. Browser and production build results below are from a clean archive of `83c985b` and the isolated PostgreSQL database. Lint and typecheck were also rerun with the equivalent named PostCSS export in `341b6cd`. Concurrent uncommitted changes to the locale landing and library pages, app shell, authorization helpers, middleware and an RBAC test were kept out of the audit commits. A workspace build hit a transient JSX parse error in the concurrently edited library page at line 255. A subsequent workspace typecheck passed. The clean archive provides the repeatable target for the end-to-end results.

| ID | Final status | Evidence and remaining work |
|---|---|---|
| Q01 | Fixed in audited revision | `a319430` scopes collection and detail mutations to the physician owner. Student collection returned 403 and redirected away from the case page. A second authenticated physician got an empty collection and 404 on the first physician's case. Administrative exception policy and changes outside the audited revision require separate verification. |
| Q02 | Contained, release blocker open | `c913e1f` returns 409 for prescription finalization and disables prescription printing. Playwright confirmed both controls. A server-side plan snapshot, safety recalculation, authenticated acknowledgment and successful finalization after acknowledgment are still required. |
| Q03 | Contained, release blocker open | `dffed62` suppresses old model-produced case analyses and returns a localized abstention. `cd5bc2a` restricts Ask to exact source excerpts and rejects unsupported claim text, unknown chunk IDs and altered quotations. The audited routes make no chat model call. Clinical diagnosis generation, clinical red flags, conflict detection and the required system prompt for any future enabled model remain unverified. |
| Q04 | Contained, release blocker open | `7033ad5` withholds unsupported treatment and adult-dose defaults. The route returns 409 with `insufficient_evidence`. An approved source-linked and patient-applicable formulary is still needed before showing doses from `drugs.dose_rules`. No dose was available to verify in the final UI. |
| Q05 | Contained, partial coverage | P-103 returned two concrete prompts, no differentials and `insufficient_evidence`. Unrelated Ask returned no answer and `insufficient_evidence`. A deliberately instruction-bearing synthetic chunk was indexed, matched by its unique term, and suppressed. Ask does not execute documents or send them to a chat model. The directive filter only covers recognizable phrases. Multilingual and semantic relevance coverage remains limited. |
| Q06 | Fixed for demo, production hardening open | `2764423` removes the fallback, rechecks database identity and role on API authorization, and stores salted scrypt hashes. Existing compatible legacy hashes migrate on login. Seeded demo credentials require explicit demo mode. Operational secret rotation, full session revocation and production account lifecycle are unverified. |
| Q07 | Partial | `99a1ca6` adds bounded parsing and Zod schemas for input-bearing handlers, scopes library reads, sanitizes handled errors, and inserts audit records transactionally with clinical/source mutations. Login, Ask and analysis have process-local throttles. Distributed enforcement, limits on all applicable routes, complete read/access and auth audit events, retention, audit integrity and abuse testing remain open. |
| Q08 | Fixed for offline quickstart, partial overall | `b002f97`, `1518da2` package a sanitized template, document schema setup, assign cases to a demo physician and index full text. Two offline rounds preserved counts and all issued chunks had a full-text vector. Original duplicate sources are preserved. Cross-version source retirement, concurrent ingestion proof, external vector relevance and end-to-end Docker setup timing remain open. |
| Q09 | Partial | `c2020b0` evaluates stored contraindications, minimum/maximum age and duplicate active ingredient. Unit coverage includes allergy, drug interaction, contraindication, pregnancy, paediatric/upper-age limits, renal and duplicate medication. Drug-class equivalence, combination products, structured matching/qualifiers, pregnancy trimester rules, candidate-pair safety and independently reviewed clinical provenance remain open. |
| Q10 | Partial | `35bbb37` fixes nested document markup that disrupted login and now exposes the correct language after direct navigation in both locales. Locale selection and cookie survived reload. Hardcoded strings, nonlocalized numbers/dates and Bangla truncation review remain. |
| Q11 | Partial | `12a2056` restores Cmd/Ctrl+K navigation. Desktop collapse, Evidence Sheet Escape and citation focus return passed. Mobile sidebar opened and trapped focus in the retry, but Escape did not close it within the wait. Global search backend, Drawer, case history/drug detail Sheets, full overlay focus and loading/error matrix remain open. |
| Q12 | Partial | Default webpack build compiles, actual offline token average is 0, and retrieval cache has a size limit. Provider usage/cost, concurrent throughput, production load and reducing client JavaScript and font weight remain open. |
| Q13 | Open | API enforces a synthetic identifier shape and separates structured patient fields, but free text can still hold identifying information. No PHI was intentionally used. Clinical provenance, consent, operational privacy, security configuration and any regulated-use review remain unverified. |
| Q14 | Open | Remaining lint/build/Vitest warnings are listed below. |
| Q15 | P1, fixed | With the initial webpack workaround, production CSS contained raw `@theme`, `@apply` and `@tailwind utilities` and lacked a compiled `.size-4` rule. The physician radio had a zero-size clickable element. `3bf673c` adds the matching Tailwind PostCSS integration. An asset assertion and the full Playwright run passed after the fix. |
| Q16 | P2, open | With compiled CSS, dashboard overflow at 768px measured 38px in Bangla and 51px in English in both themes. Axe found contrast and landmark defects, skipped heading levels and unnamed controls. One React hydration error occurred in the multi-route browser sweep. Browser results and commands are below. |

### Verification after remediation

| Exact command or invocation | Result |
|---|---|
| `pnpm add -D @tailwindcss/postcss@4.3.3 --fetch-retries=0` and `pnpm remove -D @tailwindcss/turbopack` | Succeeded. Package manager warned about deprecated eslint and esbuild-kit dependencies and a Vitest peer range mismatch with @types/node 20. |
| `git archive HEAD \| tar -x -C /tmp/docmate-qa-reviewed` then `pnpm --dir /tmp/docmate-qa-reviewed install --frozen-lockfile --offline` | Clean audit archive exported. 629 dependencies installed from cache. |
| `pnpm --dir /tmp/docmate-qa-reviewed run build` | Exit 0. Webpack compiled, checked types and generated 10 pages. Warnings for deprecated middleware naming and webpack cache serialization of a 105 KiB string. The baseline webpack fallback also exited 0, but was later found to produce raw Tailwind CSS without the plugin. |
| `python3 -c 'from pathlib import Path; css="".join(p.read_text() for p in Path("/tmp/docmate-qa-reviewed/.next/static/css").glob("*.css")); assert ".size-4{" in css and "@tailwind utilities" not in css; print("Compiled size utility found; no raw Tailwind directives")'` | Passed. |
| `pnpm --dir /tmp/docmate-qa-reviewed run lint` | Exit 0 with two warnings after rerun. Unused `setWeightKg` in case intake and unused `UserCheck` in AppShell. The first run also flagged the anonymous PostCSS config export, resolved in `341b6cd`. |
| `pnpm --dir /tmp/docmate-qa-reviewed run typecheck` | Exit 0. No diagnostics. |
| `pnpm --dir /tmp/docmate-qa-reviewed test` | 3 files and 36 tests passed. Vitest native config loader warning remains. Added unsupported citation and instruction-bearing excerpt cases and age, contraindication and duplicate medication assertions. |
| `createdb -h 127.0.0.1 -p 55439 docmate_final && psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c 'CREATE EXTENSION vector' && pnpm exec drizzle-kit push --force && pnpm run ingest && pnpm run seed && pnpm run ingest && pnpm run seed` | Run with isolated DATABASE_URL, demo mode and explicitly empty provider key. Fresh schema and both rounds succeeded. Second ingestion reused 16 chunks. Count query returned 4 sources, 16 chunks, 16 non-null full-text vectors, 4 users, 3 owned cases, 25 drugs and 11 interactions. This used host PostgreSQL, not Docker or a remote clone. |
| `set -a; source /tmp/docmate-qa-final.env; set +a; pnpm --dir /tmp/docmate-qa-reviewed start -p 3102` | Production server ready with isolated synthetic database. Earlier offline QA instances used ports 3100 and 3101. |
| `DOCMATE_QA_BASE_URL=http://localhost:3101 DOCMATE_QA_SYNTHETIC=1 pnpm run test:e2e --output /tmp/docmate-qa-final-smoke` and same command with `--output /tmp/docmate-qa-final-retry` | Each run had 4 passes and 2 failures. Initial locators selected the hidden implementation input and an inaccurate source-button label. The retry also exposed uncompiled CSS, Q15. |
| `DOCMATE_QA_BASE_URL=http://localhost:3102 DOCMATE_QA_SYNTHETIC=1 pnpm --dir /tmp/docmate-qa-reviewed run test:e2e --output /tmp/docmate-qa-verified-e2e` | All 6 passed in 4.8s. Includes doctor sign-in, case intake, analysis, answering a follow-up, clinician diagnosis, blocked treatment/finalization, report preview, Ask, keyboard command dialog, student restrictions and admin source metadata creation. No actual critical acknowledgment, medication selection or signed print succeeded because those paths are disabled. |
| `node /tmp/docmate-qa-boundaries.cjs http://localhost:3102` | Two synthetic regression checks passed. A separate physician could not read the first physician's P-103. Ask suppressed a synthetic chunk containing an instruction to ignore rules and prescribe a fictitious drug. The harness removed its two temporary fixtures afterwards. |
| `node /tmp/docmate-qa-browser.cjs` then `node /tmp/docmate-qa-browser.cjs http://localhost:3102` | Actual baseline P-103 was `ok` with three differentials, and unrelated Ask incorrectly had `found: true`. Final P-103 and P-101 both abstained, the unrelated question returned `found: false`, and all 12 dashboard variants reported the intended page locale and theme. The clean styled build had overflow at 768px only. Axe results below. |
| `node /tmp/docmate-qa-overlays.cjs http://localhost:3102` | Desktop sidebar and locale persistence passed. After correcting the evidence locator to the citation chip title, the evidence panel opened, Esc closed it and focus returned to the chip. Mobile Sheet focus stayed inside on the second run and its Esc assertion failed. |
| `node /tmp/docmate-qa-lighthouse.mjs http://localhost:3101` | Chrome for Testing returned NO_FCP and no scores on login. Interrupted the first cases run after successful prerequisite login. |
| `QA_CHROME_BIN="$HOME/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell" node /tmp/docmate-qa-lighthouse.mjs http://localhost:3102` | Retried using Playwright's headless shell and local provided throttling. Both target URLs completed. Scores below. |
| `node /tmp/docmate-qa-bundles.cjs http://localhost:3102` | Cold browser encoded/decoded asset bytes by route below. |
| `psql postgresql://127.0.0.1:55439/docmate_final -Atc "SELECT count(*),avg(tokens),min(tokens),max(tokens) FROM analyses WHERE model='docmate-abstention-v1'"` | 10 offline records, mean/min/max 0. Both active reasoning routes make zero provider calls. Provider spend for these offline runs was zero. Hosted-model cost per analysis was not measured. Auto-review blocked commands that could send internal passages without express authorization. |
| `curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\\n' http://localhost:3000/en/dashboard` | Follow-up request to user-supplied port received 307 to English login with a dashboard callback. The audited production server was tested separately on 3102. |
| `git ls-files -- '.env*'` and `git log --all --format='%h %s' -- .env .env.local` | Only sanitized `.env.example` was tracked. No commit history for those two secret files. Repository review did not establish external logging configuration or operational secret handling. |
| `pnpm exec shadcn docs command dialog` | The CLI registry lookup failed with ENOTFOUND in the restricted environment. The local generated wrappers and running behavior were inspected. |

### Retrieval after indexing

The original ten-query command was rerun with `DATABASE_URL=postgresql://127.0.0.1:55439/docmate_final` and an empty `OPENAI_API_KEY`. The hybrid entry point used lexical ranking only. Every returned row below was text rank 1. The English fixture corpus did not answer the Bangla query. Relatedness was reviewed by section and title. A clinically reviewed relevance benchmark or semantic embedding run was outside this offline check.

| Query | Top section |
|---|---|
| pneumonia | Section 2: Severity Triage & CRB-65 Score |
| amoxicillin | Section 3: First-Line Empirical Antimicrobial Regimens |
| chest pain | Section 4: Non-Cardiac Differential Diagnoses & Differentiation |
| troponin | Section 1: Initial Presentation & Red-Flag Escalation Criteria |
| dengue | Section 3: Antipyretic Safety & Absolute Contraindication of NSAIDs |
| platelets | Section 1: Clinical Presentation & Diagnostic Phases |
| hypertension | Section 1: Blood Pressure Classification & Cardiovascular Risk |
| amlodipine | Section 2: First-Line Antihypertensive Drug Classes |
| ডেঙ্গু | No result |
| quantum entanglement | No result |

### Accessibility and performance detail

| Page | Final axe violations in the English light snapshot |
|---|---|
| Login | Contrast (5 nodes), missing main landmark (1), content outside landmarks (7) |
| Dashboard | Contrast (6), heading order (1), nested and duplicate main and non-unique landmarks (1 each), content outside landmarks (9) |
| Cases | Unnamed button (1), contrast (5), nested and duplicate main and non-unique landmarks (1 each), content outside landmarks (9) |
| Library | Unnamed button (1), nested and duplicate main and non-unique landmarks (1 each), content outside landmarks (9) |
| Ask | Nested and duplicate main and non-unique landmarks (1 each), content outside landmarks (9) |

Critical alert components have icon and text by inspection. An active critical-treatment interactive state could not be exercised with treatment contained. Dashboard geometry was checked in all 12 settings. Comprehensive Bangla clipping, all dynamic error/loading states, every overlay's keyboard order, and every page/theme combination remain outside the executed checks.

| Lighthouse route | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|---:|
| English login | 100 | 94 | 100 | 91 | 0.2 s | 0.001 |
| Authenticated English cases | 100 | 90 | 96 | 91 | 0.1 s | 0.011 |

Local provided-throttling observations with one browser profile per pair. Cases reused cached shared assets in Lighthouse. A separate cold resource run measured 240,271 encoded JavaScript bytes over 10 files for login and 288,604 over 13 files for cases. Decoded JavaScript was 767,972 and 919,456 bytes respectively. Each loaded 23,568 encoded CSS bytes and 181,968 WOFF2 bytes. Six routed page modules use `use client`. The case table, shared shell and login should be reviewed for smaller client boundaries before performance is assessed on real devices and networks. These measurements are local lab results.

### Before release

- Restore clinical features only after proving claim support beyond quote presence, abstention on conflict, source provenance and appropriate patient-specific rules. Verify a positive safety approval path and a server-authored prescription that remains correct after refresh and at print time.
- Close the open identity lifecycle, distributed abuse-control, audit and privacy items. Run the clean quickstart from a real clone, with a fresh database and the intended hosting configuration.
- Close the axe, responsive, locale and focus defects and repeat the full browser matrix. Evaluate retrieval with a reviewed multilingual library and measure provider latency, tokens and cost in an explicitly authorized synthetic environment.

## Follow-up remediation

The follow-up addressed the reproducible UI findings and found additional authorization and evidence-display defects. The production release verdict remains **No-go**. The case workspace still abstains from automated assessment and keeps treatment, prescription finalization and printing disabled.

| Area | Result |
|---|---|
| Dashboard access | Dashboard queries now scope case details and counts to the authenticated owner. Student and researcher dashboards exclude the case workspace. Command search uses the same ownership rule and returns only case codes and source metadata. A second physician's dashboard HTML and search omitted P-103 and the detail API returned 404. |
| Clinical display integrity | Library load failures previously substituted a hardcoded passage. Failures now show retry and an empty source reports zero indexed passages. Intake starts without assumed vitals, age, weight or renal values. The landing page no longer advertises an unverified diagnosis, dose, safety conclusion or zero hallucinations. Report and Safety views say the assessment is unavailable and the preview is unsigned. |
| Responsive UI and accessibility | The dashboard fit 390, 768 and 1280 px in both languages and themes. Fixed nested landmarks, inaccessible filter names, heading order and the measured red alert contrast. The mobile sidebar has a close button and restores focus to the trigger. |
| Search and feedback | Cmd/Ctrl+K finds owned case codes and active library titles. Search protects authenticated identity, validates bounded text, and throttles requests. Case and library lists show retry states after failed requests. |
| Local auth and tooling | Restored the rate-limiter boundary for demo accounts. The workspace's existing AUTH_SECRET matches a recognizable published demo default. The server rejects that default and requires rotation for local login. The offline QA environment used a separate secret. The proxy and Vitest config use their supported file conventions. |

| Command | Result |
|---|---|
| `pnpm run lint`, `pnpm run typecheck`, `pnpm test` | Passed. Vitest reported 47 tests across six files after adding rate-limit and signing-secret regressions. An intermediate lint attempt flagged synchronous state updates from the library mount effect. The final code fetches asynchronously with cancellation and lint passed. |
| `pnpm run build` | Exit 0 using the workspace's current Turbopack script. Compiled, checked TypeScript and generated 11 pages. A webpack build before the last updates also passed; runtime rechecks below used Turbopack. |
| `node /tmp/docmate-qa-axe-followup.cjs http://localhost:3104` | axe-core 4.14.1 returned zero violations in English light and dark for login, dashboard, cases, library and Ask. Across the 12 dashboard combinations, the reported locale matched and horizontal overflow was 0 px. This was a targeted scan of those rendered states. |
| `node /tmp/docmate-qa-dashboard-scope.cjs http://localhost:3104` | A second signed-in physician could access their own dashboard and search but did not receive another physician's P-103 in either response. The detail request returned 404. Synthetic fixture removed after the test. |
| `DOCMATE_QA_BASE_URL=http://localhost:3103 DOCMATE_QA_SYNTHETIC=1 pnpm run test:e2e --output /tmp/docmate-qa-followup-e2e` | 8 passed, 1 failed because the newly blank vital fields produced two follow-ups with the same placeholder. The test now targets the labeled question. |
| `DOCMATE_QA_BASE_URL=http://localhost:3104 DOCMATE_QA_SYNTHETIC=1 pnpm run test:e2e --output /tmp/docmate-qa-followup-final` | 8 passed, 1 failed on a desktop-to-mobile resize before the sidebar switched modes. The test now waits for the desktop sidebar to detach. A repeat on the same process hit the account throttle after two overlapping suites. The final suite uses a fresh process. |
| `DOCMATE_QA_BASE_URL=http://localhost:3105 DOCMATE_QA_SYNTHETIC=1 pnpm run test:e2e --output /tmp/docmate-qa-followup-fresh` | All 9 tests passed in 6.8 s on the fresh process. The mobile sidebar closed with Escape and restored keyboard focus. |
| `DOCMATE_QA_BASE_URL=http://localhost:3106 DOCMATE_QA_SYNTHETIC=1 pnpm run test:e2e --output /tmp/docmate-qa-followup-hardened` | After rejecting the recognizable signing-secret default, the rebuilt app passed all 9 tests in 6.7 s with a separate QA secret. |

Still open include independently reviewed source and formulary evidence, a verified model-assisted assessment, server-authorized treatment and acknowledgment, signed prescription output, production identity and distributed controls, and accessibility and localization outside the verified pages and states.
