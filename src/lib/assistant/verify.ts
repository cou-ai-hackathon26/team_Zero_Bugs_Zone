import { z } from 'zod';
import { verifyQuoteInChunk } from '@/lib/verifier';
import type { Excerpt } from './excerpts';
import { META_DELIMITER } from './prompt';
import type { CitedClaim } from './types';

const metaSchema = z.object({
  status: z.enum(['answered', 'partial', 'insufficient_evidence', 'social']).catch('answered'),
  claims: z
    .array(
      z.object({
        id: z.coerce.number().int().min(1).max(99),
        excerpt: z.string().max(300),
        quote: z.string().max(3000),
      }),
    )
    .max(20)
    .catch([]),
  follow_up: z
    .object({
      question: z.string().max(500).nullish(),
      why: z.string().max(500).nullish(),
      quick_answers: z.array(z.string().max(200)).max(6).nullish(),
    })
    .nullish()
    .catch(null),
  missing_information: z.array(z.string().max(300)).max(8).catch([]),
});

export type ModelMeta = z.infer<typeof metaSchema>;

export interface ParsedModelOutput {
  answer: string;
  meta: ModelMeta | null;
}

/** Splits raw model output into the answer text and the META JSON block. */
export function parseModelOutput(raw: string): ParsedModelOutput {
  const index = raw.indexOf(META_DELIMITER);
  if (index === -1) return { answer: raw.trim(), meta: null };

  const answer = raw.slice(0, index).trim();
  const jsonText = raw
    .slice(index + META_DELIMITER.length)
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const objectText = firstJsonObject(jsonText);
  if (!objectText) return { answer, meta: null };

  try {
    const parsed = metaSchema.safeParse(JSON.parse(objectText));
    return { answer, meta: parsed.success ? parsed.data : null };
  } catch {
    return { answer, meta: null };
  }
}

/**
 * Returns the first balanced {...} object, ignoring braces inside strings.
 * Models sometimes add a stray closing brace or trailing text after the JSON.
 */
export function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth++;
    else if (char === '}') {
      depth--;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

const MARKER = /\[(\d{1,3})\]/g;
const DOSE = /\b\d+(?:[.,]\d+)?\s?(?:mg|mcg|µg|g|gm|ml|mL|IU|units?|tabs?|tablets?|capsules?|drops?)\b(?:\s*\/\s*(?:kg|day|d|dose))?/giu;
const DIGIT = /[0-9০-৯]/u;
const NEGATION = /\b(?:no|not|never|without|none|neither|nor|absent|avoid|don't|doesn't|isn't|aren't)\b|নেই|না\b|নয়|নিষেধ|এড়িয়ে/iu;
const LIST_PREFIX = /^\s*(?:[-*•]|\d+[.)])\s+/;
const SYNTHETIC_ID_START = 500;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitLineIntoSentences(line: string): string[] {
  return line.split(/(?<=[.!?।](?:\s?\[\d{1,3}\])*)\s+(?!\[\d)/u).filter((part) => part.trim().length > 0);
}

function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(digit.charCodeAt(0) - 0x09e6));
}

/** Lowercase, strip Markdown and punctuation; keeps letters, digits and marks. */
export function looseNormalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

function tokens(text: string): string[] {
  return looseNormalize(text).split(' ').filter((token) => token.length >= 3 || /\d/.test(token));
}

interface SourceUnit {
  excerpt: Excerpt;
  text: string; // verbatim sentence from the chunk
  normalized: string;
  tokenSet: Set<string>;
}

function sourceUnits(excerpts: Excerpt[]): SourceUnit[] {
  const units: SourceUnit[] = [];
  for (const excerpt of excerpts) {
    const sentences = excerpt.chunk.text
      .split(/(?<=[.!?।])\s+|\n+|\s(?=\d{1,2}\.\s+\p{Lu})/u)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 12);
    for (const sentence of sentences) {
      units.push({ excerpt, text: sentence, normalized: looseNormalize(sentence), tokenSet: new Set(tokens(sentence)) });
    }
  }
  return units;
}

/**
 * Finds a source sentence that supports `sentence`: either it contains the
 * sentence verbatim (ignoring case, Markdown and punctuation), or it shares at
 * least `threshold` of the sentence's words with every number and negation preserved.
 */
export function findSupport(sentence: string, units: SourceUnit[], threshold = 0.85): SourceUnit | null {
  const normalized = looseNormalize(sentence);
  if (normalized.length < 12) return null;
  const sentenceTokens = tokens(sentence);
  if (sentenceTokens.length < 3) return null;
  const numbers = sentenceTokens.filter((token) => /\d/.test(token));
  const negated = NEGATION.test(sentence);

  let best: { unit: SourceUnit; score: number } | null = null;
  for (const unit of units) {
    if (unit.normalized.includes(normalized)) return unit;
    if (numbers.some((number) => !unit.tokenSet.has(number))) continue;
    if (negated !== NEGATION.test(unit.text)) continue;
    const overlap = sentenceTokens.filter((token) => unit.tokenSet.has(token)).length / sentenceTokens.length;
    if (overlap >= threshold && (!best || overlap > best.score)) best = { unit, score: overlap };
  }
  return best?.unit ?? null;
}

/**
 * True when the quote appears verbatim (whitespace-normalized) in the chunk.
 * Quotes elided with "..." pass only when every fragment of at least 8
 * characters appears verbatim, in order.
 */
export function quoteAppearsIn(quote: string, chunkText: string): boolean {
  if (verifyQuoteInChunk(quote, chunkText)) return true;
  const fragments = quote.split(/\s*(?:\.\.\.|…)\s*/).map((fragment) => fragment.trim()).filter(Boolean);
  if (fragments.length < 2 || fragments.some((fragment) => fragment.length < 8)) return false;
  const haystack = chunkText.replace(/\s+/g, ' ');
  let position = 0;
  for (const fragment of fragments) {
    const found = haystack.indexOf(fragment.replace(/\s+/g, ' '), position);
    if (found === -1) return false;
    position = found + fragment.length;
  }
  return true;
}

export interface VerifiedAnswer {
  text: string;
  claims: CitedClaim[];
  droppedClaims: number;
  droppedSentences: number;
}

/**
 * Deterministic verification of a model answer (AGENTS.md rules 2, 3 and 6):
 * - every claim quote must appear verbatim (whitespace-normalized) in its excerpt;
 * - a sentence or bullet is kept when all its markers verify, or when a library
 *   sentence supports it word for word (it is then cited to that sentence);
 * - otherwise only a short list intro ending in ":" survives (or social small talk);
 * - doses and every other number survive only when they appear in the supporting quote.
 * Surviving markers are renumbered 1..n in reading order.
 */
export function verifyModelAnswer(
  answer: string,
  meta: ModelMeta | null,
  excerpts: Excerpt[],
  options: { framingWordLimit?: number; maxFramingSentences?: number; allowUncitedProse?: boolean } = {},
): VerifiedAnswer {
  const framingWordLimit = options.framingWordLimit ?? 18;
  const maxFramingSentences = options.maxFramingSentences ?? 3;
  let framingUsed = 0;
  const byRef = new Map(excerpts.map((excerpt) => [excerpt.ref.toUpperCase(), excerpt]));
  const verifiedById = new Map<number, { quote: string; excerpt: Excerpt }>();
  let droppedClaims = 0;

  const claimExcerptRef = new Map<number, string>();
  for (const claim of meta?.claims ?? []) {
    const quote = claim.quote.trim().replace(/^["“]|["”]$/g, '');
    // Models sometimes cite the excerpt header instead of its id. The quote is
    // still checked deterministically against the chunk it is attributed to.
    const refMatch = claim.excerpt.trim().toUpperCase().match(/^E\d{1,2}$/);
    const excerpt = refMatch
      ? byRef.get(refMatch[0])
      : excerpts.find((candidate) => quoteAppearsIn(quote, candidate.chunk.text));
    if (excerpt && quote.length >= 8 && quoteAppearsIn(quote, excerpt.chunk.text)) {
      verifiedById.set(claim.id, { quote: quote.replace(/\s*(?:\.\.\.|…)\s*/g, ' … '), excerpt });
      claimExcerptRef.set(claim.id, excerpt.ref.toUpperCase());
      continue;
    }
    // Near-verbatim quote: cite the real source sentence instead, so the quote
    // shown to the doctor is always the library's own wording.
    const candidates = sourceUnits(excerpt ? [excerpt] : excerpts);
    const repaired = findSupport(quote, candidates, 0.8);
    if (repaired) {
      verifiedById.set(claim.id, { quote: repaired.text, excerpt: repaired.excerpt });
      claimExcerptRef.set(claim.id, repaired.excerpt.ref.toUpperCase());
    } else {
      droppedClaims++;
    }
  }

  // Models sometimes write the excerpt number as the marker ("[5]" for E5).
  // Map such a marker to the verified claim from that excerpt when unambiguous.
  const declaredIds = new Set((meta?.claims ?? []).map((claim) => claim.id));
  for (const excerpt of excerpts) {
    const number = Number(excerpt.ref.slice(1));
    if (declaredIds.has(number)) continue;
    const fromExcerpt = [...claimExcerptRef.entries()].filter(([, ref]) => ref === excerpt.ref.toUpperCase());
    if (fromExcerpt.length === 1) verifiedById.set(number, verifiedById.get(fromExcerpt[0][0])!);
  }

  const units = sourceUnits(excerpts);
  let nextSyntheticId = SYNTHETIC_ID_START;
  const syntheticByUnit = new Map<SourceUnit, number>();

  const citeUnit = (unit: SourceUnit): number => {
    // Reuse a model claim when its quote already covers this sentence.
    for (const [id, entry] of verifiedById) {
      if (entry.excerpt === unit.excerpt && looseNormalize(entry.quote).includes(unit.normalized)) return id;
    }
    const existing = syntheticByUnit.get(unit);
    if (existing) return existing;
    const id = nextSyntheticId++;
    verifiedById.set(id, { quote: unit.text, excerpt: unit.excerpt });
    syntheticByUnit.set(unit, id);
    return id;
  };

  const dosesSupported = (plain: string, quotes: string[]): boolean => {
    const doses = plain.match(DOSE) ?? [];
    if (!doses.every((dose) => quotes.some((quote) => looseNormalize(quote).includes(looseNormalize(dose))))) return false;
    // Every number in a cited sentence (thresholds, durations, doses) must come
    // from the quote it cites. Bangla digits are compared as ASCII.
    const quoteNumbers = new Set(quotes.flatMap((quote) => toAsciiDigits(quote).match(/\d+(?:[.,]\d+)*/g) ?? []));
    const sentenceNumbers = toAsciiDigits(plain.replace(MARKER, '')).match(/\d+(?:[.,]\d+)*/g) ?? [];
    return sentenceNumbers.every((number) => quoteNumbers.has(number) || quoteNumbers.has(number.replace(/,/g, '')));
  };

  let droppedSentences = 0;
  const keptLines: string[] = [];

  for (const rawLine of answer.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      keptLines.push('');
      continue;
    }
    const prefixMatch = line.match(/^(\s*(?:[-*•]|\d+[.)])\s+|\s*#{1,3}\s+|\s*>\s*)/);
    const prefix = prefixMatch?.[0] ?? '';
    const isListItem = LIST_PREFIX.test(prefix);
    const body = line.slice(prefix.length);

    const keptSentences: string[] = [];
    for (const sentence of splitLineIntoSentences(body)) {
      const markers = [...sentence.matchAll(MARKER)].map((match) => Number(match[1]));
      const plain = sentence.replace(MARKER, '').trim();

      if (markers.length > 0 && markers.every((id) => verifiedById.has(id))) {
        const quotes = markers.map((id) => verifiedById.get(id)!.quote);
        if (dosesSupported(plain, quotes)) {
          keptSentences.push(sentence);
          continue;
        }
      }

      const support = findSupport(plain, units);
      if (support && dosesSupported(plain, [support.text])) {
        const trailing = plain.match(/[.!?।:]$/)?.[0] ?? '';
        const core = trailing ? plain.slice(0, -1).trimEnd() : plain;
        keptSentences.push(`${core} [${citeUnit(support)}]${trailing}`);
        continue;
      }

      // Uncited text is kept only as a short list intro ("Watch for these signs:"),
      // or as conversational text in social replies.
      const isFraming =
        markers.length === 0 &&
        !isListItem &&
        framingUsed < maxFramingSentences &&
        !DIGIT.test(plain) &&
        wordCount(plain) <= framingWordLimit &&
        (options.allowUncitedProse === true || plain.endsWith(':'));
      if (isFraming) {
        framingUsed++;
        keptSentences.push(sentence);
      } else {
        droppedSentences++;
      }
    }

    if (keptSentences.length > 0) keptLines.push(prefix + keptSentences.join(' '));
  }

  // Remove dangling list headers ("Key points:" with nothing after) and extra blank lines.
  const cleaned: string[] = [];
  for (let index = 0; index < keptLines.length; index++) {
    const line = keptLines[index];
    if (line.trim().endsWith(':')) {
      const next = keptLines.slice(index + 1).find((candidate) => candidate.trim());
      if (!next || next.trim().endsWith(':')) continue;
    }
    if (!line.trim() && (!cleaned.length || !cleaned[cleaned.length - 1].trim())) continue;
    cleaned.push(line);
  }

  // Renumber markers in reading order.
  const renumber = new Map<number, number>();
  const claims: CitedClaim[] = [];
  const text = cleaned
    .join('\n')
    .trim()
    .replace(MARKER, (_match, idText: string) => {
      const id = Number(idText);
      const entry = verifiedById.get(id);
      if (!entry) return '';
      if (!renumber.has(id)) {
        const ref = claims.length + 1;
        renumber.set(id, ref);
        claims.push({
          ref,
          text: entry.quote,
          claim_text: entry.quote,
          quote: entry.quote,
          chunk_id: entry.excerpt.chunk.id,
          source_title: entry.excerpt.chunk.source_title,
          source_year: entry.excerpt.chunk.source_year,
          page: entry.excerpt.chunk.page,
          section: entry.excerpt.chunk.section,
          verified: true,
          verification_status: 'verified',
        });
      }
      return `[${renumber.get(id)}]`;
    });

  // Collapse duplicate adjacent markers, e.g. "[1] [1]".
  return { text: text.replace(/(\[\d+\])(\s*\1)+/g, '$1'), claims, droppedClaims, droppedSentences };
}
