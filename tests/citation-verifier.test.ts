import { describe, it, expect } from 'vitest';
import { normalizeText, verifyQuoteInChunk, verifyClaims } from '@/lib/verifier';
import { Chunk } from '@/types';

describe('Citation Verifier Engine (Hard Rule: Verbatim Citation Requirement)', () => {
  const sampleChunkText = `
    Community-acquired pneumonia (CAP) in adults is defined as an acute infection of the
    pulmonary parenchyma acquired outside a hospital setting. Classical symptoms include cough,
    fever, pleuritic chest pain, dyspnea, and production of purulent or rust-colored sputum.
    Oral Amoxicillin 500 mg to 1000 mg three times daily (every 8 hours) for 5 to 7 days is
    the recommended first-line therapy.
  `;

  const sampleChunk: Chunk = {
    id: 'chunk-cap-01',
    source_id: 'source-ari-01',
    source_title: 'National Guidelines for Acute Respiratory Infections',
    source_year: 2024,
    page: 4,
    section: 'Section 1: Diagnostic Criteria',
    text: sampleChunkText,
    evidence_level: 'Ia',
    created_at: new Date().toISOString(),
  };

  it('normalizes whitespace, multiple newlines, and smart quotes', () => {
    const raw = '  Classical   symptoms\n\n\tinclude “cough,  fever” \n ';
    const normalized = normalizeText(raw);
    expect(normalized).toBe('classical symptoms include "cough, fever"');
  });

  it('verifies exact verbatim quote present in chunk', () => {
    const quote = 'Classical symptoms include cough, fever, pleuritic chest pain, dyspnea';
    const isVerified = verifyQuoteInChunk(quote, sampleChunkText);
    expect(isVerified).toBe(true);
  });

  it('verifies quote spanning across line breaks and tabs with varying whitespace', () => {
    const quoteWithNewlines = 'infection of the\n    pulmonary parenchyma acquired outside';
    const isVerified = verifyQuoteInChunk(quoteWithNewlines, sampleChunkText);
    expect(isVerified).toBe(true);
  });

  it('rejects fabricated or hallucinated quotes not present in the chunk', () => {
    const hallucinatedQuote = 'Patients should always take Ciprofloxacin 500 mg once daily';
    const isVerified = verifyQuoteInChunk(hallucinatedQuote, sampleChunkText);
    expect(isVerified).toBe(false);
  });

  it('rejects quotes with partial falsification or altered numbers', () => {
    const alteredDoseQuote = 'Oral Amoxicillin 250 mg twice daily for 3 days is the recommended';
    const isVerified = verifyQuoteInChunk(alteredDoseQuote, sampleChunkText);
    expect(isVerified).toBe(false);
  });

  it('rejects empty or whitespace-only quotes', () => {
    expect(verifyQuoteInChunk('', sampleChunkText)).toBe(false);
    expect(verifyQuoteInChunk('   \n  \t ', sampleChunkText)).toBe(false);
  });

  it('verifyClaims accepts verified quotes and drops all unverified claims', () => {
    const chunksMap = new Map<string, Chunk>();
    chunksMap.set(sampleChunk.id, sampleChunk);

    const candidateClaims = [
      {
        text: 'Patient exhibits classical pneumonia presentation',
        chunk_id: 'chunk-cap-01',
        quote: 'Classical symptoms include cough, fever, pleuritic chest pain',
      },
      {
        text: 'Amoxicillin is recommended first-line therapy',
        chunk_id: 'chunk-cap-01',
        quote: 'Oral Amoxicillin 500 mg to 1000 mg three times daily (every 8 hours)',
      },
      {
        text: 'Fabricated recommendation not in source text',
        chunk_id: 'chunk-cap-01',
        quote: 'Prednisolone 40 mg daily must be administered immediately',
      },
      {
        text: 'Claim citing non-existent chunk ID',
        chunk_id: 'chunk-unknown-999',
        quote: 'Classical symptoms include cough',
      },
    ];

    const result = verifyClaims(candidateClaims, chunksMap);

    expect(result.verifiedClaims).toHaveLength(2);
    expect(result.droppedClaimsCount).toBe(2);
    expect(result.allVerified).toBe(false);
    expect(result.verifiedClaims[0].quote).toContain('Classical symptoms');
    expect(result.verifiedClaims[1].quote).toContain('Amoxicillin 500 mg');
    expect(result.verifiedClaims[0].verified).toBe(true);
  });
});
