import crypto from 'crypto';
import { CleanedPage } from './cleaner';

export interface ChunkOutput {
  ordinal: number;
  headingPath: string;
  pageStart: number;
  pageEnd: number;
  kind: 'body' | 'table' | 'list' | 'skip' | 'references';
  text: string;
  embeddingText: string;
  contentHash: string;
  tokenCount: number;
  language: 'bn' | 'en' | 'mixed';
}

export function estimateTokenCount(text: string): number {
  let bnCharCount = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0x0980 && code <= 0x09ff) bnCharCount++;
  }
  const otherCharCount = text.length - bnCharCount;
  // Bengali words avg 2.5 chars/token; English words avg 4 chars/token
  return Math.max(1, Math.round(bnCharCount / 2.5 + otherCharCount / 4));
}

export function computeContentHash(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

// Split text into coherent sentences without cutting decimals or abbreviations
export function splitIntoSentences(text: string): string[] {
  // Matches punctuation (. ? ! or Bangla danda ।) followed by whitespace or end of line
  // Avoids splitting decimals like 3.5 or 0.25
  const rawSegments = text.split(/(?<=[.?!।])\s+/);
  const sentences: string[] = [];

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (trimmed.length > 0) {
      sentences.push(trimmed);
    }
  }

  return sentences.length > 0 ? sentences : [text];
}

export function structureAwareChunk(
  documentTitleOrPages: string | CleanedPage[],
  pagesOrTitle?: CleanedPage[] | string,
  targetTokens = 500,
  minTokens = 300,
  maxTokens = 700,
  overlapRatio = 0.12
): ChunkOutput[] {
  let documentTitle = 'Document';
  let pages: CleanedPage[] = [];

  if (typeof documentTitleOrPages === 'string') {
    documentTitle = documentTitleOrPages;
    pages = (pagesOrTitle as CleanedPage[]) || [];
  } else {
    pages = documentTitleOrPages || [];
    documentTitle = typeof pagesOrTitle === 'string' ? pagesOrTitle : 'Document';
  }
  const result: ChunkOutput[] = [];
  const seenContentHashes = new Set<string>();
  let currentOrdinal = 1;
  let activeHeadingPath = documentTitle;

  for (const page of pages) {
    if (page.kind === 'skip') {
      continue;
    }

    if (page.heading && page.heading !== 'Overview') {
      activeHeadingPath = `${documentTitle} > ${page.heading}`;
    }

    // References / Bibliography: store as single intact references chunk
    if (page.kind === 'references') {
      const hash = computeContentHash(page.text);
      if (!seenContentHashes.has(hash)) {
        seenContentHashes.add(hash);
        result.push({
          ordinal: currentOrdinal++,
          headingPath: `${activeHeadingPath} > References`,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          kind: 'references',
          text: page.text,
          embeddingText: `${documentTitle} > References\n\n${page.text}`,
          contentHash: hash,
          tokenCount: estimateTokenCount(page.text),
          language: page.language,
        });
      }
      continue;
    }

    // Markdown tables: keep whole as table chunk
    if (page.tables && page.tables.length > 0) {
      for (const tbl of page.tables) {
        const hash = computeContentHash(tbl);
        if (!seenContentHashes.has(hash)) {
          seenContentHashes.add(hash);
          result.push({
            ordinal: currentOrdinal++,
            headingPath: `${activeHeadingPath} > Table`,
            pageStart: page.pageNumber,
            pageEnd: page.pageNumber,
            kind: 'table',
            text: tbl,
            embeddingText: `${activeHeadingPath} > Table\n\n${tbl}`,
            contentHash: hash,
            tokenCount: estimateTokenCount(tbl),
            language: page.language,
          });
        }
      }
    }

    // Body Text: Split into paragraphs, then sentences
    const paragraphs = (page.text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    let currentSentences: string[] = [];
    let currentTokens = 0;

    const flushChunk = () => {
      if (currentSentences.length === 0) return;
      const chunkText = currentSentences.join(' ').trim();
      if (chunkText.length < 20) {
        currentSentences = [];
        currentTokens = 0;
        return;
      }

      const hash = computeContentHash(chunkText);
      // Dedupe Level 5: Drop exact duplicate boilerplate chunks inside same document
      if (!seenContentHashes.has(hash)) {
        seenContentHashes.add(hash);
        result.push({
          ordinal: currentOrdinal++,
          headingPath: activeHeadingPath,
          pageStart: page.pageNumber,
          pageEnd: page.pageNumber,
          kind: /^\s*[-*•\d]\s+/m.test(chunkText) ? 'list' : 'body',
          text: chunkText,
          embeddingText: `${activeHeadingPath}\n\n${chunkText}`,
          contentHash: hash,
          tokenCount: estimateTokenCount(chunkText),
          language: page.language,
        });
      }

      // 12% sentence-aligned overlap
      const overlapTokensTarget = Math.round(targetTokens * overlapRatio);
      const overlapSentences: string[] = [];
      let accumulatedOverlapTokens = 0;

      for (let i = currentSentences.length - 1; i >= 0; i--) {
        const s = currentSentences[i];
        const tCount = estimateTokenCount(s);
        if (accumulatedOverlapTokens + tCount <= overlapTokensTarget) {
          overlapSentences.unshift(s);
          accumulatedOverlapTokens += tCount;
        } else {
          break;
        }
      }

      currentSentences = overlapSentences;
      currentTokens = accumulatedOverlapTokens;
    };

    for (const para of paragraphs) {
      // Check if paragraph is a heading line (e.g. "### Chapter 2" or "Section 3:")
      if (/^(#{1,4}\s+|[A-Z0-9\u09E6-\u09EF\s]{3,40}:|Section\s+\d+:)/i.test(para) && para.length < 90) {
        flushChunk();
        activeHeadingPath = `${documentTitle} > ${para.replace(/^#+\s*/, '')}`;
        continue;
      }

      const sentences = splitIntoSentences(para);
      for (const sentence of sentences) {
        const sentTokens = estimateTokenCount(sentence);
        if (currentTokens + sentTokens > maxTokens && currentTokens >= minTokens) {
          flushChunk();
        }
        currentSentences.push(sentence);
        currentTokens += sentTokens;
      }
    }

    flushChunk();
  }

  return result;
}
