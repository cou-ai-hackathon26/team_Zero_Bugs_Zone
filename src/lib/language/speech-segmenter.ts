// src/lib/language/speech-segmenter.ts
// DocMate AI - Bilingual Speech Segmenter for Text-To-Speech (TTS)

export interface SpeechSegment {
  text: string;
  lang: 'bn' | 'en';
}

const BANGLA_CHAR_REGEX = /[\u0980-\u09FF]/;
const LATIN_CHAR_REGEX = /[a-zA-Z]/;

/**
 * Splits a bilingual medical string into clean spoken segments for TTS engines.
 * Segments predominantly containing Bengali script use 'bn-BD' voice.
 * Pure English phrases (e.g. drug names, medical terms in brackets) use 'en-US' voice.
 */
export function segmentForSpeech(text: string): SpeechSegment[] {
  if (!text || !text.trim()) return [];

  // Remove markdown formatting like bold, italics, citations
  const cleanText = text
    .replace(/\[\^chunk_[a-zA-Z0-9_-]+\]/g, '') // remove citation marks
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();

  // Pattern matching parenthesized English terms: "নিউমোনিয়া (Pneumonia)" -> "Pneumonia"
  // or multi-word English sentences
  const segments: SpeechSegment[] = [];

  // Tokenize by sentence or clause boundaries
  const clauses = cleanText.split(/([।!?\n]+)/);

  for (const clause of clauses) {
    if (!clause.trim()) continue;

    // Split words and check script
    const words = clause.trim().split(/\s+/);
    let currentLang: 'bn' | 'en' | null = null;
    let currentBuffer: string[] = [];

    for (const word of words) {
      const hasBangla = BANGLA_CHAR_REGEX.test(word);
      const hasLatin = LATIN_CHAR_REGEX.test(word);

      let wordLang: 'bn' | 'en' = 'bn';
      if (hasLatin && !hasBangla) {
        wordLang = 'en';
      } else {
        wordLang = 'bn';
      }

      if (currentLang === null) {
        currentLang = wordLang;
        currentBuffer.push(word);
      } else if (currentLang === wordLang) {
        currentBuffer.push(word);
      } else {
        segments.push({
          text: currentBuffer.join(' '),
          lang: currentLang,
        });
        currentLang = wordLang;
        currentBuffer = [word];
      }
    }

    if (currentBuffer.length > 0 && currentLang !== null) {
      segments.push({
        text: currentBuffer.join(' '),
        lang: currentLang,
      });
    }
  }

  // Merge consecutive segments of the same language
  if (segments.length <= 1) return segments;

  const merged: SpeechSegment[] = [];
  let current = segments[0];

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    if (next.lang === current.lang) {
      current = {
        text: `${current.text} ${next.text}`.trim(),
        lang: current.lang,
      };
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}
