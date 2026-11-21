import type { VerifiedClaim, Chunk } from '@/types';

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function verifyQuoteInChunk(quote: string, chunkText: string): boolean {
  const normalized = normalizeText(quote);
  return normalized.length > 0 && normalizeText(chunkText).includes(normalized);
}

export function verifyClaims(
  claims: { text: string; chunk_id: string; quote: string }[],
  chunksMap: Map<string, Chunk>,
) {
  const verifiedClaims: VerifiedClaim[] = [];
  for (const claim of claims) {
    const chunk = chunksMap.get(claim.chunk_id);
    // Verbatim occurrence cannot establish semantic support for arbitrary paraphrases.
    if (!chunk || normalizeText(claim.text) !== normalizeText(claim.quote)) continue;
    if (!verifyQuoteInChunk(claim.quote, chunk.text)) continue;

    verifiedClaims.push({
      text: claim.quote,
      quote: claim.quote,
      chunk_id: chunk.id,
      source_title: chunk.source_title,
      source_year: chunk.source_year,
      page: chunk.page,
      verified: true,
      verification_status: 'verified',
    });
  }
  const droppedClaimsCount = claims.length - verifiedClaims.length;
  return { verifiedClaims, droppedClaimsCount, allVerified: droppedClaimsCount === 0 && verifiedClaims.length > 0 };
}
