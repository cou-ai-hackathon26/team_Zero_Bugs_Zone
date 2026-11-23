import type { LanguageUnderstandingResult } from '@/lib/language';
import type { StructuredPatientInput } from '@/types';

const MAX_QUERIES = 4;

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.replace(/\s+/g, ' ').trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length < 2 || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

/**
 * Builds patient-aware retrieval queries. Questions such as "what are the top
 * differentials?" carry no clinical terms of their own, so the case's complaint
 * and symptoms are added to every request.
 */
export function buildRetrievalQueries(
  text: string,
  understanding: Pick<LanguageUnderstandingResult, 'canonicalEnglishQuery' | 'retrievalQueries' | 'entities'> | null,
  patient: StructuredPatientInput,
  previousDoctorText?: string,
): string[] {
  const entityTerms = [
    ...(understanding?.entities?.symptoms ?? [])
      .filter((symptom) => symptom.present !== false)
      .map((symptom) => symptom.canonicalEn || symptom.name),
    ...(understanding?.entities?.medicines ?? []).map((medicine) => medicine.canonicalEn || medicine.name),
  ].filter(Boolean) as string[];

  const patientTerms = [patient?.chief_complaint ?? '', ...(patient?.symptoms ?? [])].filter(Boolean);
  const patientContext = patientTerms.join(' ');

  const queries: string[] = [text];
  if (understanding?.canonicalEnglishQuery) queries.push(understanding.canonicalEnglishQuery);
  if (entityTerms.length) queries.push(entityTerms.join(' '));
  if (patientContext) {
    queries.push([understanding?.canonicalEnglishQuery || text, patientContext].join(' '));
  }
  if (text.trim().split(/\s+/).length <= 3 && previousDoctorText) {
    queries.push(`${previousDoctorText} ${text}`);
  }
  for (const query of understanding?.retrievalQueries ?? []) queries.push(query);

  return unique(queries).slice(0, MAX_QUERIES);
}
