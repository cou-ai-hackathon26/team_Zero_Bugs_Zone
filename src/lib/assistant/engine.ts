import { extractClinicalFacts } from '@/lib/clinical-extractor';
import { understandText, type LanguageUnderstandingResult } from '@/lib/language';
import { checkRedFlags } from '@/lib/red-flags';
import { detectSystemQuery } from '@/lib/system-query';
import { analyzeDoctorInput } from '@/lib/persona/humanize/session-adaptive';
import { selectPhrase, type TonePreset } from '@/lib/persona/phrasebank';
import { verifyQuoteInChunk } from '@/lib/verifier';
import { bestSentences, keyTerms, selectExcerpts, type Excerpt } from './excerpts';
import { acceptModelFollowUp, deterministicFollowUp } from './followups';
import { buildMessages, META_DELIMITER } from './prompt';
import { buildWeightedRetrievalQueries } from './retrieval-queries';
import { parseModelOutput, verifyModelAnswer } from './verify';
import type {
  AssistantReply,
  CitedClaim,
  EngineDeps,
  EngineEvent,
  EngineInput,
  ReplyLocale,
} from './types';

// Five-letter stems that mean the same thing in clinical text, for the relevance gate.
const SYNONYM_GROUPS = [
  ['admit', 'admis', 'hospi', 'inpat', 'ward'],
  ['treat', 'thera', 'manag', 'regim', 'presc'],
  ['medic', 'drug', 'antib', 'dose'],
  ['test', 'inves', 'labor', 'ecg', 'troponin', 'count'],
  ['sign', 'sympt', 'featu', 'findi', 'prese'],
  ['dange', 'warni', 'red-f', 'sever', 'emerg'],
  ['disch', 'recov'],
  ['fluid', 'drink', 'hydra', 'ors'],
];
const SYNONYMS: Record<string, string[]> = Object.fromEntries(
  SYNONYM_GROUPS.flatMap((group) => group.map((stem) => [stem, group])),
);

const QUESTION_CUE =
  /[?？]|\b(?:what|which|how|when|why|where|should|can|could|is|are|does|do|dose|guideline|protocol|recommend|differential|treatment|manage|test)\b|কী|কি\b|কোন|কখন|কত|কেন|কীভাবে|কিভাবে|উচিত|চিকিৎসা|পরীক্ষা|ki\b|koto|keno|kivabe/iu;

function localized(locale: ReplyLocale, bnText: string, enText: string): string {
  return locale === 'bn' ? bnText : enText;
}

function noEvidenceText(locale: ReplyLocale, tone: string, sessionId: string): string {
  return selectPhrase('no_evidence', locale, { preset: tone as TonePreset, sessionId });
}

function understandingMeta(result: LanguageUnderstandingResult | null): Record<string, unknown> | undefined {
  if (!result) return undefined;
  return {
    detected_lang: result.detectedLang,
    dominant_lang: result.dominantLang,
    canonical_query: result.canonicalEnglishQuery,
    intent: result.intent,
    entities: result.entities,
    ambiguity: result.ambiguity,
  };
}

/** Deterministic library-excerpt answer used when no model is available or the model fails. */
export function excerptAnswer(
  excerpts: Excerpt[],
  queries: string[],
  locale: ReplyLocale,
): { text: string; claims: CitedClaim[] } {
  const terms = keyTerms(queries);
  const claims: CitedClaim[] = [];
  const lines: string[] = [];

  for (const excerpt of excerpts.slice(0, 2)) {
    const sentences = bestSentences(excerpt.chunk.text, terms, 2);
    if (sentences.length === 0) continue;
    const quote = sentences.join(' ');
    if (!verifyQuoteInChunk(quote, excerpt.chunk.text) && !sentences.every((s) => verifyQuoteInChunk(s, excerpt.chunk.text))) {
      continue;
    }
    for (const sentence of sentences) {
      const ref = claims.length + 1;
      claims.push({
        ref,
        text: sentence,
        claim_text: sentence,
        quote: sentence,
        chunk_id: excerpt.chunk.id,
        source_title: excerpt.chunk.source_title,
        source_year: excerpt.chunk.source_year,
        page: excerpt.chunk.page,
        section: excerpt.chunk.section,
        verified: true,
        verification_status: 'verified',
      });
      lines.push(`> ${sentence} [${ref}]`);
    }
    lines.push('');
  }

  if (claims.length === 0) return { text: '', claims };
  const intro = localized(
    locale,
    'পূর্ণ উত্তর তৈরি করা যায়নি। লাইব্রেরির সবচেয়ে কাছের অংশগুলো হুবহু দিচ্ছি, যাচাই করে দেখুন:',
    "I couldn't write a full answer, so here are the closest library passages, quoted word for word:",
  );
  return { text: [intro, '', ...lines].join('\n').trim(), claims };
}

/** Plain-English description of the case, used to search the library for a case review. */
export function describeCaseForSearch(patient: EngineInput['patient']): string {
  const vitals = patient?.vitals ?? {};
  const findings: string[] = [];
  if (vitals.temperature_celsius && vitals.temperature_celsius >= 38) findings.push('fever');
  if (vitals.blood_pressure_systolic && vitals.blood_pressure_systolic < 90) findings.push('hypotension low blood pressure');
  if (vitals.blood_pressure_systolic && vitals.blood_pressure_systolic >= 140) findings.push('high blood pressure hypertension');
  if (vitals.heart_rate && vitals.heart_rate > 100) findings.push('tachycardia');
  if (vitals.spo2_percent && vitals.spo2_percent < 94) findings.push('low oxygen saturation');
  if (vitals.respiratory_rate && vitals.respiratory_rate >= 30) findings.push('respiratory rate 30');
  return [patient?.chief_complaint, ...(patient?.symptoms ?? []), patient?.history_of_present_illness, ...findings]
    .filter(Boolean)
    .join(', ');
}

/** One-line case summary built from the record (never from the model). */
export function caseSummaryLine(patient: EngineInput['patient'], locale: ReplyLocale): string {
  const isBn = locale === 'bn';
  const sex = { male: isBn ? 'পুরুষ' : 'male', female: isBn ? 'নারী' : 'female', other: isBn ? 'অন্যান্য' : 'other' }[patient?.gender ?? 'other'] ?? '';
  const who = patient?.age !== undefined ? (isBn ? `${patient.age} বছর, ${sex}` : `${patient.age}-year-old ${sex}`) : sex;
  const v = patient?.vitals ?? {};
  const vitals = [
    v.blood_pressure_systolic && v.blood_pressure_diastolic ? `BP ${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}` : null,
    v.heart_rate ? `HR ${v.heart_rate}` : null,
    v.temperature_celsius ? `${isBn ? 'তাপমাত্রা' : 'Temp'} ${v.temperature_celsius}°C` : null,
    v.spo2_percent ? `SpO2 ${v.spo2_percent}%` : null,
    v.respiratory_rate ? `RR ${v.respiratory_rate}` : null,
  ].filter(Boolean);
  const parts = [who, patient?.chief_complaint].filter(Boolean).join(isBn ? ', ' : ' with ');
  const vitalsText = vitals.length ? vitals.join(', ') : isBn ? 'ভাইটালস এখনও রেকর্ড হয়নি' : 'no vitals recorded yet';
  const stop = isBn ? '।' : '.';
  return `**${isBn ? 'কেস' : 'Case'}:** ${parts}${stop} ${vitalsText}${stop}`;
}

/**
 * Spoken version of a reply: the opening sentence plus up to four list items
 * read as one natural sentence, about 60 words at most. Citation markers,
 * Markdown and parenthetical English glosses are removed.
 */
export function speechFrom(text: string, locale: ReplyLocale): string {
  const isBn = locale === 'bn';
  const clean = (line: string) =>
    line
      .replace(/\s?\[\d+\]/g, '')
      .replace(/[*_`#>]/g, '')
      .replace(/^\s*(?:[-•]|\d+[.)])\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();
  const lines = text.split('\n').map((line) => ({ bullet: /^\s*(?:[-*•]|\d+[.)])\s+/.test(line), text: clean(line) })).filter((line) => line.text);
  if (!lines.length) return '';

  const opening = lines.find((line) => !line.bullet)?.text ?? '';
  const bullets = lines.filter((line) => line.bullet).map((line) => line.text.replace(/[.।:]+$/, ''));
  // Read only the term before a colon or parenthesis: "Persistent vomiting (≥ 3 ...)" → "Persistent vomiting".
  const shortBullets = bullets.map((item) => item.split(/[:(]/)[0].trim()).filter(Boolean).slice(0, 4);
  const sentences = opening.split(/(?<=[.!?।:])\s+/u);
  // Keep the list intro ("The warning signs are:") so the list makes sense when heard.
  const firstSentence = sentences.length > 1 && opening.endsWith(':')
    ? `${sentences[0]} ${sentences[sentences.length - 1]}`
    : sentences[0] ?? '';
  const joiner = isBn ? ', ' : ', ';
  const list = shortBullets.length
    ? shortBullets.length > 1
      ? `${shortBullets.slice(0, -1).join(joiner)}${isBn ? ' এবং ' : ' and '}${shortBullets.at(-1)}`
      : shortBullets[0]
    : '';
  let spoken = [firstSentence, list ? `${list}${isBn ? '।' : '.'}` : ''].filter(Boolean).join(' ');
  const words = spoken.split(' ');
  if (words.length > 60) spoken = `${words.slice(0, 60).join(' ')}…`;
  const more = bullets.length > shortBullets.length || lines.length > 1 + bullets.length;
  const cue = more ? localized(locale, 'বাকিটা স্ক্রিনে আছে।', 'The rest is on screen.') : '';
  return [spoken, cue].filter(Boolean).join(' ');
}

/**
 * Runs one assistant turn: understand → safety → retrieve → generate → verify.
 * Emits progress events and returns the final, verified reply. Never throws for
 * model failures; it falls back to deterministic library excerpts instead.
 */
export async function runAssistantTurn(
  input: EngineInput,
  deps: EngineDeps,
  emit: (event: EngineEvent) => void,
): Promise<AssistantReply> {
  const sessionId = input.sessionId;
  emit({ type: 'trace', step: 'understand', status: 'running' });

  let understanding: LanguageUnderstandingResult | null = null;
  try {
    understanding = await understandText(input.text, {
      userPrefs: { replyLanguage: input.replyLanguagePref, banglishReply: input.banglishReply ?? false },
    });
  } catch {
    understanding = null;
  }
  const locale: ReplyLocale = understanding
    ? understanding.replyLanguage === 'en'
      ? 'en'
      : 'bn'
    : input.replyLanguagePref === 'en'
      ? 'en'
      : 'bn';

  const proposedUpdates = extractClinicalFacts(input.text, input.patient);
  const safetyAlerts = checkRedFlags(
    `${input.text} ${input.patient?.chief_complaint ?? ''} ${(input.patient?.symptoms ?? []).join(' ')}`,
    locale,
  );
  if (safetyAlerts.length) emit({ type: 'safety', alerts: safetyAlerts });
  emit({ type: 'trace', step: 'understand', status: 'done' });

  const base = {
    proposedUpdates,
    safetyAlerts,
    replyLanguage: locale,
    understanding: understandingMeta(understanding),
    droppedClaims: 0,
    missingInformation: [] as string[],
  };

  // 1. Deterministic utility questions (date, time, identity).
  const systemQuery = input.kind === 'question_answer' ? null : detectSystemQuery(input.text);
  if (systemQuery) {
    return {
      ...base,
      text: locale === 'bn' ? systemQuery.answerBn : systemQuery.answerEn,
      status: 'system',
      mode: 'deterministic',
      claims: [],
      followUp: null,
    };
  }

  const signals = analyzeDoctorInput(input.text, { sessionId, turnCount: input.context.turnCount }, safetyAlerts);
  const looksLikeQuestion = QUESTION_CUE.test(input.text);
  const isSocial =
    input.kind === 'observation' &&
    proposedUpdates.length === 0 &&
    safetyAlerts.length === 0 &&
    (signals.isThanks || understanding?.intent === 'greeting') &&
    input.text.length < 80;

  // 2. Pure dictation: confirm extracted facts without a model round-trip.
  const isDictation =
    proposedUpdates.length > 0 &&
    input.kind !== 'evidence_review' &&
    !looksLikeQuestion &&
    (understanding?.intent === 'dictate_intake' || understanding?.intent === 'answer_followup' || input.kind === 'question_answer');
  if (isDictation) {
    const names = proposedUpdates.map((update) => `${locale === 'bn' ? update.label_bn : update.label_en}: **${update.display_value}**`);
    const nextQuestion = deterministicFollowUp(input.patient, input.context.followUps, locale, input.text, proposedUpdates);
    const text = [
      localized(locale, 'নোট করলাম।', 'Noted.'),
      ...names.map((name) => `- ${name}`),
      '',
      localized(locale, 'রোগীর রেকর্ডে যোগ করতে নিচে নিশ্চিত করুন।', 'Confirm below to add these to the patient record.'),
    ].join('\n');
    return { ...base, text, status: 'recorded', mode: 'deterministic', claims: [], followUp: nextQuestion };
  }

  // 3. Retrieval for clinical turns.
  let excerpts: Excerpt[] = [];
  let queries: string[] = [];
  let english: string | null = null;
  // A case review searches with the patient's presentation, not the trigger text.
  const isCaseReview = input.kind === 'evidence_review';
  const caseDescription = isCaseReview ? describeCaseForSearch(input.patient) : '';
  const retrievalText = isCaseReview && caseDescription
    ? caseDescription
    : input.question
      ? `${input.question.text} ${input.text}`
      : input.text;
  if (!isSocial) {
    emit({ type: 'trace', step: 'retrieve', status: 'running' });
    const previousDoctor = [...input.context.history].reverse().find((message) => message.role === 'doctor')?.text;
    // Library sources are English: translate Bangla and Banglish questions first.
    const needsTranslation = /[\u0980-\u09FF]/.test(retrievalText) || understanding?.detectedLang === 'banglish';
    english = needsTranslation && deps.llm?.translate ? await deps.llm.translate(retrievalText) : null;
    const weighted = buildWeightedRetrievalQueries(retrievalText, understanding, input.patient, previousDoctor, english);
    queries = weighted.queries;
    try {
      excerpts = selectExcerpts(await deps.retrieve(weighted.queries, 12, weighted.weights), 8);
      emit({ type: 'trace', step: 'retrieve', status: 'done', count: excerpts.length });
    } catch {
      excerpts = [];
      emit({ type: 'trace', step: 'retrieve', status: 'error' });
    }
  }

  // 4. Generation with the model.
  if (deps.llm) {
    emit({ type: 'trace', step: 'generate', status: 'running' });
    const messages = buildMessages({
      locale,
      doctorTitle: input.doctorTitle,
      tone: input.tone,
      verbosity: input.verbosity,
      mode: isSocial ? 'social' : isCaseReview ? 'case_review' : 'clinical',
      patient: input.patient,
      context: input.context,
      excerpts,
      doctorText: input.text,
      questionBeingAnswered: input.question?.text,
      proposedUpdates,
    });

    let raw = '';
    let streamedLength = 0;
    let failed = false;
    try {
      for await (const token of deps.llm.stream(messages, input.signal)) {
        raw += token;
        const delimiterAt = raw.indexOf(META_DELIMITER);
        // Hold back enough characters to never leak a partial delimiter.
        const visibleEnd = delimiterAt === -1 ? Math.max(0, raw.length - META_DELIMITER.length) : delimiterAt;
        if (visibleEnd > streamedLength) {
          emit({ type: 'delta', text: raw.slice(streamedLength, visibleEnd) });
          streamedLength = visibleEnd;
        }
      }
    } catch {
      failed = true;
    }

    if (input.signal.aborted) {
      return { ...base, text: '', status: 'stopped', mode: 'llm', claims: [], followUp: null, model: deps.llm.model };
    }

    const parsed = parseModelOutput(raw);
    if (!failed && parsed.meta) {
      emit({ type: 'trace', step: 'generate', status: 'done' });
      emit({ type: 'trace', step: 'verify', status: 'running' });
      const verified = verifyModelAnswer(parsed.answer, parsed.meta, excerpts, {
        framingWordLimit: isSocial ? 40 : 18,
        allowUncitedProse: isSocial,
        question: input.question ? `${input.question.text} ${input.text}` : input.text,
      });
      emit({ type: 'trace', step: 'verify', status: 'done', count: verified.claims.length });

      if (isSocial) {
        return {
          ...base,
          text: verified.text || parsed.answer.split('\n')[0].slice(0, 300),
          status: 'social',
          mode: 'llm',
          claims: [],
          followUp: null,
          model: deps.llm.model,
        };
      }

      // Relevance gate: the cited quotes must share at least one key term with
      // the question itself (not the patient context). This stops answers to a
      // different question, e.g. hypertension drugs for a physics question.
      const questionSources = [english ?? '', understanding?.canonicalEnglishQuery ?? '', retrievalText];
      const acronyms = questionSources.join(' ').match(/\b[A-Z][A-Z0-9-]{1,6}\b/g)?.map((acronym) => acronym.toLowerCase()) ?? [];
      // Five-letter stems so "definition" matches "defined".
      const questionTerms = [...new Set([...keyTerms(questionSources).map((term) => term.slice(0, 5)), ...acronyms])];
      const citedChunks = excerpts.filter((excerpt) => verified.claims.some((claim) => claim.chunk_id === excerpt.chunk.id));
      const sourceText = citedChunks
        .map((excerpt) => `${excerpt.chunk.source_title ?? ''} ${excerpt.chunk.section ?? ''} ${excerpt.chunk.text}`)
        .join(' ')
        .toLowerCase();
      // One shared term is enough for short questions; longer questions need two,
      // so a single incidental word ("mechanisms") cannot pass the gate.
      const matched = questionTerms.filter((term) => (SYNONYMS[term] ?? [term]).some((variant) => sourceText.includes(variant))).length;
      const relevant = questionTerms.length === 0 || matched >= (questionTerms.length >= 4 ? 2 : 1);
      if (!relevant && process.env.DOCMATE_DEBUG_ASSISTANT === '1') {
        console.warn(`[assistant] relevance gate blocked answer; terms=${questionTerms.join(',')} matched=${matched}; cited=${citedChunks.map((e) => e.chunk.section).join(' | ')}; claims=${verified.claims.map((c) => c.chunk_id).join(',')}`);
      }
      if (!relevant) verified.claims.splice(0, verified.claims.length);
      const answered = verified.claims.length > 0;
      const summary = isCaseReview ? `${caseSummaryLine(input.patient, locale)}\n\n` : '';
      const text = answered
        ? summary + verified.text
        : summary + [relevant ? verified.text : '', noEvidenceText(locale, input.tone, sessionId)].filter(Boolean).join('\n\n');
      const followUp =
        acceptModelFollowUp(parsed.meta.follow_up, input.context.followUps) ??
        (answered && !isCaseReview ? null : deterministicFollowUp(input.patient, input.context.followUps, locale, input.text, proposedUpdates));

      return {
        ...base,
        text,
        status: answered ? 'answered' : 'insufficient_evidence',
        mode: 'llm',
        claims: verified.claims,
        followUp,
        droppedClaims: verified.droppedClaims,
        missingInformation: answered ? [] : parsed.meta.missing_information,
        model: deps.llm.model,
      };
    }

    // Model failed or returned no usable META block: discard the draft.
    if (process.env.DOCMATE_DEBUG_ASSISTANT === '1') {
      console.warn(`[assistant] model output unusable (${failed ? 'stream error' : 'no valid META'}), ${raw.length} chars; tail: ${raw.slice(-300)}`);
    }
    emit({ type: 'reset' });
    emit({ type: 'trace', step: 'generate', status: 'error' });
  }

  // 5. Deterministic fallback.
  if (isSocial) {
    const text = signals.isThanks
      ? selectPhrase('thanks_reply', locale, { preset: input.tone as TonePreset, doctorTitle: input.doctorTitle, sessionId })
      : selectPhrase('greeting', locale, { preset: input.tone as TonePreset, doctorTitle: input.doctorTitle, sessionId });
    return { ...base, text, status: 'social', mode: 'deterministic', claims: [], followUp: null };
  }

  // Match passages to the question itself; patient context alone must not
  // make a passage look relevant (a case review uses the case description).
  const fallback = excerptAnswer(excerpts, [retrievalText, english ?? ''], locale);
  const found = fallback.claims.length > 0;
  return {
    ...base,
    text: found ? fallback.text : noEvidenceText(locale, input.tone, sessionId),
    status: found ? 'excerpts' : 'insufficient_evidence',
    mode: 'library_excerpts',
    claims: fallback.claims,
    followUp: deterministicFollowUp(input.patient, input.context.followUps, locale, input.text, proposedUpdates),
  };
}
