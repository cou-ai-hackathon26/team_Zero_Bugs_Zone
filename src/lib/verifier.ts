import { VerifiedClaim, Chunk } from '@/types';

// Normalizes whitespace, removes punctuation inconsistencies and converts to lowercase
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width chars
    .replace(/[“”"']/g, '"') // normalize quotes
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

export function verifyQuoteInChunk(quote: string, chunkText: string): boolean {
  if (!quote || !chunkText) return false;
  const normQuote = normalizeText(quote);
  const normChunk = normalizeText(chunkText);
  if (normQuote.length === 0) return false;
  return normChunk.includes(normQuote);
}

export interface ClaimVerificationResult {
  verifiedClaims: VerifiedClaim[];
  droppedClaimsCount: number;
  allVerified: boolean;
}

export function verifyClaims(
  claims: { text: string; chunk_id: string; quote: string }[],
  chunksMap: Map<string, Chunk>
): ClaimVerificationResult {
  let dropped = 0;
  const verified: VerifiedClaim[] = [];

  for (const c of claims) {
    const chunk = chunksMap.get(c.chunk_id);
    if (!chunk) {
      dropped++;
      continue;
    }

    const isMatch = verifyQuoteInChunk(c.quote, chunk.text);
    if (isMatch) {
      verified.push({
        text: c.text,
        chunk_id: c.chunk_id,
        quote: c.quote,
        source_title: chunk.source_title,
        source_year: chunk.source_year,
        page: chunk.page,
        verified: true,
        verification_status: 'verified',
      });
    } else {
      dropped++;
    }
  }

  return {
    verifiedClaims: verified,
    droppedClaimsCount: dropped,
    allVerified: dropped === 0 && verified.length > 0,
  };
}
