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

export function speechFrom(text: string, locale: ReplyLocale): string {
  const plain = text
    .replace(/\s?\[\d+\]/g, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = plain.split(/(?<=[.!?।])\s+/u).slice(0, 2).join(' ');
  const words = sentences.split(' ');
  const capped = words.length > 35 ? `${words.slice(0, 35).join(' ')}…` : sentences;
  if (!capped) return '';
  return `${capped} ${localized(locale, 'বিস্তারিত স্ক্রিনে দেখুন।', 'Details are on screen.')}`;
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
  const retrievalText = input.question ? `${input.question.text} ${input.text}` : input.text;
  if (!isSocial) {
    emit({ type: 'trace', step: 'retrieve', status: 'running' });
    const previousDoctor = [...input.context.history].reverse().find((message) => message.role === 'doctor')?.text;
    // Library sources are English: translate Bangla and Banglish questions first.
    const needsTranslation = /[\u0980-\u09FF]/.test(retrievalText) || understanding?.detectedLang === 'banglish';
    english = needsTranslation && deps.llm?.translate ? await deps.llm.translate(retrievalText) : null;
    const weighted = buildWeightedRetrievalQueries(retrievalText, understanding, input.patient, previousDoctor, english);
    queries = weighted.queries;
    try {
      excerpts = selectExcerpts(await deps.retrieve(weighted.queries, 8, weighted.weights), 6);
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
      mode: isSocial ? 'social' : 'clinical',
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
      const matched = questionTerms.filter((term) => sourceText.includes(term)).length;
      const relevant = questionTerms.length === 0 || matched >= (questionTerms.length >= 4 ? 2 : 1);
      if (!relevant && process.env.DOCMATE_DEBUG_ASSISTANT === '1') {
        console.warn(`[assistant] relevance gate blocked answer; terms=${questionTerms.join(',')} matched=${matched}; cited=${citedChunks.map((e) => e.chunk.section).join(' | ')}; claims=${verified.claims.map((c) => c.chunk_id).join(',')}`);
      }
      if (!relevant) verified.claims.splice(0, verified.claims.length);
      const answered = verified.claims.length > 0;
      const text = answered
        ? verified.text
        : [relevant ? verified.text : '', noEvidenceText(locale, input.tone, sessionId)].filter(Boolean).join('\n\n');
      const followUp =
        acceptModelFollowUp(parsed.meta.follow_up, input.context.followUps) ??
        (answered ? null : deterministicFollowUp(input.patient, input.context.followUps, locale, input.text, proposedUpdates));

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

  const fallback = excerptAnswer(excerpts, queries, locale);
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
