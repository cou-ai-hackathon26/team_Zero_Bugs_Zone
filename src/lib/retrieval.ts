import { pool } from '@/db';
import OpenAI from 'openai';
import { Chunk } from '@/types';
import { getRawAiCredentials } from '@/lib/ai-credentials';

// In-memory cache for embeddings and retrieval (cost control & speed)
const retrievalCache = new Map<string, { timestamp: number; chunks: ScoredChunk[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export function clearRetrievalCache(): void {
  retrievalCache.clear();
}

export interface ScoredChunk extends Chunk {
  rrfScore: number;
  vectorRank?: number;
  textRank?: number;
  vectorScore?: number;
  textScore?: number;
  contentHash?: string;
  headingPath?: string;
  sourceVersionId?: string;
  ordinal?: number;
}

async function getQueryEmbedding(query: string): Promise<number[] | null> {
  const creds = await getRawAiCredentials();
  const apiKey = creds?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: creds?.baseUrl || undefined,
    });
    const response = await client.embeddings.create({
      model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
      input: query,
      dimensions: 1536,
    });
    return response.data[0].embedding;
  } catch {
    return null;
  }
}

export async function singleQueryHybridSearch(query: string, limit = 15): Promise<ScoredChunk[]> {
  const embedding = await getQueryEmbedding(query);
  const vectorStr = embedding ? `[${embedding.join(',')}]` : null;

  const isBengali = /[\u0980-\u09FF]/.test(query);
  const tsvConfig = isBengali ? 'simple' : 'english';

  // 1. Vector Search (Restricted strictly to published sources & active chunks)
  const vectorQuery = `
    SELECT c.id, c.source_id, c.source_version_id, c.ordinal, c.page, c.section, c.heading_path,
           c.text, c.evidence_level, c.content_hash, c.token_count,
           s.title as source_title, s.year as source_year,
           1 - (c.embedding <=> $1::vector) as vector_score
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE s.lifecycle = 'published' AND s.status = 'active' AND c.status = 'active'
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> $1::vector ASC
    LIMIT $2;
  `;

  // 2. Full-Text Search (tsvector with language-specific configuration)
  const textQuery = `
    SELECT c.id, c.source_id, c.source_version_id, c.ordinal, c.page, c.section, c.heading_path,
           c.text, c.evidence_level, c.content_hash, c.token_count,
           s.title as source_title, s.year as source_year,
           ts_rank(c.tsv, plainto_tsquery('${tsvConfig}', $1)) as text_score
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE s.lifecycle = 'published' AND s.status = 'active' AND c.status = 'active'
      AND c.tsv @@ plainto_tsquery('${tsvConfig}', $1)
    ORDER BY text_score DESC
    LIMIT $2;
  `;

  const [vectorRes, textRes] = await Promise.all([
    vectorStr ? pool.query(vectorQuery, [vectorStr, limit]) : Promise.resolve({ rows: [] }),
    pool.query(textQuery, [query, limit]),
  ]);

  const k = 60; // Standard RRF smoothing constant
  const scoreMap = new Map<string, ScoredChunk>();

  // Add vector ranks
  vectorRes.rows.forEach((row, idx) => {
    const rank = idx + 1;
    const rrf = 1 / (k + rank);
    scoreMap.set(row.id, {
      id: row.id,
      source_id: row.source_id,
      source_title: row.source_title,
      source_year: row.source_year,
      page: row.page,
      section: row.section,
      headingPath: row.heading_path,
      sourceVersionId: row.source_version_id,
      ordinal: row.ordinal,
      contentHash: row.content_hash,
      text: row.text,
      evidence_level: row.evidence_level,
      created_at: new Date().toISOString(),
      rrfScore: rrf,
      vectorRank: rank,
      vectorScore: Number(row.vector_score),
    });
  });

  // Add text ranks and merge
  textRes.rows.forEach((row, idx) => {
    const rank = idx + 1;
    const rrf = 1 / (k + rank);
    if (scoreMap.has(row.id)) {
      const existing = scoreMap.get(row.id)!;
      existing.rrfScore += rrf;
      existing.textRank = rank;
      existing.textScore = Number(row.text_score);
    } else {
      scoreMap.set(row.id, {
        id: row.id,
        source_id: row.source_id,
        source_title: row.source_title,
        source_year: row.source_year,
        page: row.page,
        section: row.section,
        headingPath: row.heading_path,
        sourceVersionId: row.source_version_id,
        ordinal: row.ordinal,
        contentHash: row.content_hash,
        text: row.text,
        evidence_level: row.evidence_level,
        created_at: new Date().toISOString(),
        rrfScore: rrf,
        textRank: rank,
        textScore: Number(row.text_score),
      });
    }
  });

  // Deduplicate chunks with identical content_hash
  const uniqueHashes = new Set<string>();
  const deduped: ScoredChunk[] = [];

  const sorted = Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);
  for (const chunk of sorted) {
    if (chunk.contentHash) {
      if (uniqueHashes.has(chunk.contentHash)) {
        continue; // drop redundant boilerplate chunk
      }
      uniqueHashes.add(chunk.contentHash);
    }
    deduped.push(chunk);
  }

  return deduped;
}

// Multi-query hybrid retrieval with reciprocal rank fusion across key findings
export async function hybridRetrieve(queries: string[], maxChunks = 12): Promise<ScoredChunk[]> {
  const cacheKey = queries.map((q) => q.trim().toLowerCase()).sort().join('||');
  const cached = retrievalCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.chunks.slice(0, maxChunks);
  }

  const results = await Promise.all(
    queries.filter(Boolean).map((q) => singleQueryHybridSearch(q, 10))
  );

  const merged = new Map<string, ScoredChunk>();
  for (const list of results) {
    for (const chunk of list) {
      if (merged.has(chunk.id)) {
        merged.get(chunk.id)!.rrfScore += chunk.rrfScore;
      } else {
        merged.set(chunk.id, { ...chunk });
      }
    }
  }

  const sorted = Array.from(merged.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, maxChunks);

  if (retrievalCache.size >= 256) retrievalCache.delete(retrievalCache.keys().next().value!);
  retrievalCache.set(cacheKey, { timestamp: Date.now(), chunks: sorted });
  return sorted;
}

/**
 * Small-to-big retrieval: Expands a core matched chunk with adjacent ordinal chunks
 * from the same version up to a maximum token budget.
 */
export async function expandChunkContext(
  chunkId: string,
  maxAdditionalTokens = 500
): Promise<{ expandedText: string; chunkIds: string[] }> {
  const baseRes = await pool.query<{
    source_version_id: string | null;
    ordinal: number | null;
    text: string;
    token_count: number;
  }>(
    `SELECT source_version_id, ordinal, text, token_count FROM chunks WHERE id = $1;`,
    [chunkId]
  );

  if (baseRes.rows.length === 0) {
    return { expandedText: '', chunkIds: [] };
  }

  const base = baseRes.rows[0];
  if (!base.source_version_id || base.ordinal === null) {
    return { expandedText: base.text, chunkIds: [chunkId] };
  }

  // Fetch immediately preceding and succeeding chunks
  const neighborsRes = await pool.query<{ id: string; ordinal: number; text: string; token_count: number }>(
    `SELECT id, ordinal, text, token_count
     FROM chunks
     WHERE source_version_id = $1 AND ordinal IN ($2, $3) AND status = 'active'
     ORDER BY ordinal ASC;`,
    [base.source_version_id, base.ordinal - 1, base.ordinal + 1]
  );

  let totalTokens = base.token_count || 100;
  const parts: { ordinal: number; text: string; id: string }[] = [
    { ordinal: base.ordinal, text: base.text, id: chunkId },
  ];

  for (const neighbor of neighborsRes.rows) {
    if (totalTokens + (neighbor.token_count || 100) <= maxAdditionalTokens + (base.token_count || 100)) {
      parts.push({ ordinal: neighbor.ordinal, text: neighbor.text, id: neighbor.id });
      totalTokens += neighbor.token_count || 100;
    }
  }

  parts.sort((a, b) => a.ordinal - b.ordinal);

  return {
    expandedText: parts.map((p) => p.text).join('\n\n'),
    chunkIds: parts.map((p) => p.id),
  };
}

export async function searchLibraryText(query: string, limit: number): Promise<Chunk[]> {
  const isBengali = /[\u0980-\u09FF]/.test(query);
  const tsvConfig = isBengali ? 'simple' : 'english';

  const { rows } = await pool.query<Chunk>(
    `SELECT c.id, c.source_id, c.page, c.section, c.text, c.evidence_level, c.created_at,
            s.title AS source_title, s.year AS source_year
     FROM chunks c
     JOIN sources s ON s.id = c.source_id
     WHERE s.lifecycle = 'published' AND s.status = 'active' AND c.status = 'active'
       AND c.tsv @@ plainto_tsquery('${tsvConfig}', $1)
     ORDER BY ts_rank(c.tsv, plainto_tsquery('${tsvConfig}', $1)) DESC, c.id
     LIMIT $2`,
    [query, limit],
  );
  return rows;
}
