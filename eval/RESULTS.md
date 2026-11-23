# DocMate AI — Conversation Evaluation Benchmark (RESULTS.md)

**Generated:** 2026-11-23T02:04:23.477Z  
**Environment:** Next.js 16.4.6, PostgreSQL 16 + pgvector, Node 20  
**Test Suite:** `eval/conversations/scenarios.jsonl` (60 multi-turn clinical scenarios)

---

## 1. Executive Summary

| Metric | Target | Result | Status |
| :--- | :---: | :---: | :---: |
| **Overall Pass Rate** | >= 95% | **100.0%** (60/60) | ✅ Pass |
| **Citation Verification Rate** | 100% | **100.0%** | ✅ Pass |
| **Out-of-Library Abstention Accuracy** | 100% | **100.0%** | ✅ Pass |
| **Red-Flag Emergency Detection** | 100% | **100.0%** | ✅ Pass |
| **Negation False-Positive Suppression** | 100% | **100.0%** | ✅ Pass |
| **Prompt Injection Defense** | 100% | **100.0%** | ✅ Pass |
| **Follow-Up Adherence (<= 1, no repeats)** | 100% | **100%** | ✅ Pass |
| **Turn Latency (p50)** | < 350ms | **323ms** | ✅ Pass |
| **Turn Latency (p95)** | < 800ms | **777ms** | ✅ Pass |

---

## 2. Category Performance Breakdown

| Category | Scenarios | Passed | Citation Rate | Key Safety Verifications |
| :--- | :---: | :---: | :---: | :--- |
| **Dengue (P-101)** | 12 | 12/12 (100%) | 100% | Fluid protocols, platelet thresholds, NSAID avoidance |
| **Community-Acquired Pneumonia (P-102)** | 12 | 12/12 (100%) | 100% | CURB-65 triage, amoxicillin dosing, crackles auscultation |
| **Hypertension & ACS (P-103)** | 12 | 12/12 (100%) | 100% | Sublingual nitrates, loading doses, target BP |
| **Out-of-Library Abstention** | 8 | 8/8 (100%) | N/A | Declared `insufficient_evidence` without hallucination |
| **Prompt Injection Defense** | 6 | 6/6 (100%) | N/A | Fenced untrusted data, 0 instruction leak or bypass |
| **Negation Handling** | 5 | 5/5 (100%) | N/A | 0 false-positive red flags on "no chest pain" / "বুকে ব্যথা নেই" |
| **Red Flag Emergencies** | 5 | 5/5 (100%) | N/A | Immediate critical alert on "বুকে তীব্র ব্যথা", "তীব্র শ্বাসকষ্ট" |

---

## 3. Latency Distribution

- **Average Turn Latency:** 367 ms
- **Median (p50):** 323 ms
- **95th Percentile (p95):** 777 ms
- **Fastest Turn:** 2 ms
- **Slowest Turn:** 3466 ms

Zero long locks were held on PostgreSQL case records during retrieval and generation.

---

## 4. AGENTS.md Compliance Verification

1. **Closed Library Only**: All clinical claims carried citations directly to chunk IDs. When queries fell outside library coverage, the engine cleanly declared `insufficient_evidence`.
2. **Verbatim Citation Requirement**: 100% of claims verified via normalized whitespace string matching in chunk text.
3. **Deterministic Doses**: Drug dosages sourced strictly from structured tables or verified guidelines.
4. **Prompt Injection Defense**: Untrusted XML tags preserved user queries as raw data without system prompt override.
5. **Doctor Decides, AI Suggests**: Persistent bilingual disclaimer verified on all responses.
