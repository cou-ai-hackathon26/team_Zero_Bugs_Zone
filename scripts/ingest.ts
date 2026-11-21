import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';
import OpenAI from 'openai';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

async function getEmbedding(text: string): Promise<string | null> {
  if (!openai) return null;
  const response = await openai.embeddings.create({
    model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
    input: text.replace(/\n/g, ' '),
    dimensions: 1536,
  });
  return `[${response.data[0].embedding.join(',')}]`;
}

interface ParsedDoc {
  title: string;
  year: number;
  evidenceLevel: string;
  license: string;
  sections: { section: string; text: string; page: number }[];
}

function parseMarkdownFile(filePath: string): ParsedDoc {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let title = path.basename(filePath, path.extname(filePath));
  let year = 2024;
  let evidenceLevel = 'Ia';
  let license = 'Open Access / Clinical Demo Material';

  const sections: { section: string; text: string; page: number }[] = [];
  let currentSection = 'Overview';
  let currentLines: string[] = [];
  let page = 1;

  for (const line of lines) {
    if (line.startsWith('**Source Title**:')) {
      title = line.replace('**Source Title**:', '').trim();
    } else if (line.startsWith('**Publication Year**:')) {
      const y = parseInt(line.replace('**Publication Year**:', '').trim(), 10);
      if (!isNaN(y)) year = y;
    } else if (line.startsWith('**Evidence Level**:')) {
      evidenceLevel = line.replace('**Evidence Level**:', '').trim();
    } else if (line.startsWith('**License**:')) {
      license = line.replace('**License**:', '').trim();
    } else if (line.startsWith('### Section') || line.startsWith('## Section') || line.startsWith('### ')) {
      if (currentLines.length > 0) {
        sections.push({
          section: currentSection,
          text: currentLines.join('\n').trim(),
          page,
        });
        currentLines = [];
        page++;
      }
      currentSection = line.replace(/^#+\s*/, '').trim();
    } else if (!line.startsWith('#') && !line.startsWith('---')) {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      section: currentSection,
      text: currentLines.join('\n').trim(),
      page,
    });
  }

  return { title, year, evidenceLevel, license, sections };
}

// Splits long text into ~500 word chunks with 10% overlap
function chunkText(text: string, maxTokens = 500, overlapRatio = 0.1): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxTokens) return [text];

  const chunks: string[] = [];
  const overlap = Math.floor(maxTokens * overlapRatio);
  const step = maxTokens - overlap;

  for (let i = 0; i < words.length; i += step) {
    const chunkWords = words.slice(i, i + maxTokens);
    chunks.push(chunkWords.join(' '));
    if (i + maxTokens >= words.length) break;
  }
  return chunks;
}

export async function runIngestion() {
  console.log('--- Starting DocMate AI Knowledge Ingestion ---');
  const libraryDir = path.join(process.cwd(), 'data', 'library');

  if (!fs.existsSync(libraryDir)) {
    throw new Error('Library directory not found.');
  }

  const files = fs.readdirSync(libraryDir).filter((f) => f.endsWith('.md') || f.endsWith('.txt'));
  console.log(`Found ${files.length} guideline files in data/library.`);

  for (const file of files) {
    const filePath = path.join(libraryDir, file);
    const parsed = parseMarkdownFile(filePath);
    console.log(`Processing: "${parsed.title}" (${parsed.year}, Level: ${parsed.evidenceLevel})`);

    const client = await pool.connect();
    let chunkCount = 0;
    let skippedCount = 0;
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`docmate-ingest:${parsed.title}:${parsed.year}`]);
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM sources WHERE title = $1 AND year = $2 AND type = 'guideline'
         ORDER BY (EXISTS (SELECT 1 FROM chunks WHERE source_id = sources.id)) DESC, created_at, id LIMIT 1`,
        [parsed.title, parsed.year],
      );
      const source = existing.rows[0] ?? (await client.query<{ id: string }>(
        `INSERT INTO sources (title, type, year, license, status)
         VALUES ($1, 'guideline', $2, $3, 'active') RETURNING id`,
        [parsed.title, parsed.year, parsed.license],
      )).rows[0];

      for (const sec of parsed.sections) {
        for (const text of chunkText(sec.text)) {
          if (text.length < 20) continue;

          const hash = computeHash(text);
          const { rows: [prior] } = await client.query<{ id: string; has_embedding: boolean }>(
            `SELECT id, embedding IS NOT NULL AS has_embedding FROM chunks
             WHERE source_id = $1 AND page = $2 AND section = $3 AND hash = $4 LIMIT 1`,
            [source.id, sec.page, sec.section, hash],
          );
          if (prior) {
            const embedding = prior.has_embedding && openai ? null : await getEmbedding(text);
            await client.query(
              `UPDATE chunks SET tsv = to_tsvector('english', text),
               embedding = COALESCE($2::vector, embedding) WHERE id = $1`,
              [prior.id, embedding],
            );
            skippedCount++;
            continue;
          }

          await client.query(
            `INSERT INTO chunks (source_id, page, section, text, embedding, evidence_level, hash, tsv)
             VALUES ($1, $2, $3, $4, $5::vector, $6, $7, to_tsvector('english', $4))`,
            [source.id, sec.page, sec.section, text, await getEmbedding(text), parsed.evidenceLevel, hash],
          );
          chunkCount++;
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    console.log(`  -> Indexed ${chunkCount} new chunks (${skippedCount} reused by hash).`);
  }

  console.log('Knowledge ingestion finished successfully.');
}

if (require.main === module) {
  runIngestion()
    .then(() => pool.end())
    .catch(() => {
      console.error('Ingestion failed. Check the database, schema and optional embedding configuration.');
      pool.end();
      process.exit(1);
    });
}
