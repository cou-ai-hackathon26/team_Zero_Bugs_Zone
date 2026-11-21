import { Pool } from 'pg';
import crypto from 'crypto';
import OpenAI from 'openai';
import { Chunk } from '@/types';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate',
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

// In-memory cache for embeddings and retrieval (cost control & speed)
const embeddingCache = new Map<string, number[]>();
const retrievalCache = new Map<string, { timestamp: number; chunks: ScoredChunk[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface ScoredChunk extends Chunk {
  rrfScore: number;
  vectorRank?: number;
  textRank?: number;
  vectorScore?: number;
  textScore?: number;
}

function generateDeterministicVector(text: string): number[] {
  const hash = crypto.createHash('sha256').update(text.trim().toLowerCase()).digest();
  const vector: number[] = new Array(1536);
  let norm = 0;
  for (let i = 0; i < 1536; i++) {
    const val = ((hash[i % hash.length] + (i * 31)) % 1000) / 500 - 1;
    vector[i] = val;
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

export async function getQueryEmbedding(query: string): Promise<number[]> {
  const cacheKey = query.trim().toLowerCase();
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  let embedding: number[];
  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const response = await openai.embeddings.create({
        model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
        input: query.replace(/\n/g, ' '),
      });
      embedding = response.data[0].embedding;
    } catch {
      embedding = generateDeterministicVector(query);
    }
  } else {
    embedding = generateDeterministicVector(query);
  }

  embeddingCache.set(cacheKey, embedding);
  return embedding;
}

export async function singleQueryHybridSearch(query: string, limit = 15): Promise<ScoredChunk[]> {
  const embedding = await getQueryEmbedding(query);
  const vectorStr = `[${embedding.join(',')}]`;

  // 1. Vector Search
  const vectorQuery = `
    SELECT c.id, c.source_id, c.page, c.section, c.text, c.evidence_level,
           s.title as source_title, s.year as source_year,
           1 - (c.embedding <=> $1::vector) as vector_score
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE c.embedding IS NOT NULL
    ORDER BY c.embedding <=> $1::vector ASC
    LIMIT $2;
  `;

  // 2. Full-Text Search (tsvector)
  const textQuery = `
    SELECT c.id, c.source_id, c.page, c.section, c.text, c.evidence_level,
           s.title as source_title, s.year as source_year,
           ts_rank(c.tsv, plainto_tsquery('english', $1)) as text_score
    FROM chunks c
    JOIN sources s ON c.source_id = s.id
    WHERE c.tsv @@ plainto_tsquery('english', $1)
    ORDER BY text_score DESC
    LIMIT $2;
  `;

  const [vectorRes, textRes] = await Promise.all([
    pool.query(vectorQuery, [vectorStr, limit]),
    pool.query(textQuery, [query, limit]).catch(() => ({ rows: [] })),
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
        text: row.text,
        evidence_level: row.evidence_level,
        created_at: new Date().toISOString(),
        rrfScore: rrf,
        textRank: rank,
        textScore: Number(row.text_score),
      });
    }
  });

  return Array.from(scoreMap.values()).sort((a, b) => b.rrfScore - a.rrfScore);
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

  retrievalCache.set(cacheKey, { timestamp: Date.now(), chunks: sorted });
  return sorted;
}
