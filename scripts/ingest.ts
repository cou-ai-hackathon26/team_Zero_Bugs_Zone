import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';
import OpenAI from 'openai';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate',
});

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content.trim()).digest('hex');
}

// Generates deterministic 1536-dimension normalized vector when offline or OPENAI_API_KEY is not set
function generateDeterministicVector(text: string): number[] {
  const hash = crypto.createHash('sha256').update(text).digest();
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

async function getEmbedding(text: string): Promise<number[]> {
  if (openai && process.env.OPENAI_API_KEY) {
    try {
      const response = await openai.embeddings.create({
        model: process.env.OPENAI_EMBED_MODEL || 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
      });
      return response.data[0].embedding;
    } catch (err) {
      console.warn('OpenAI embedding call failed, falling back to deterministic vector:', err instanceof Error ? err.message : err);
    }
  }
  return generateDeterministicVector(text);
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
    console.error(`Library directory not found: ${libraryDir}`);
    return;
  }

  const files = fs.readdirSync(libraryDir).filter((f) => f.endsWith('.md') || f.endsWith('.txt'));
  console.log(`Found ${files.length} guideline files in data/library.`);

  for (const file of files) {
    const filePath = path.join(libraryDir, file);
    const parsed = parseMarkdownFile(filePath);
    console.log(`Processing: "${parsed.title}" (${parsed.year}, Level: ${parsed.evidenceLevel})`);

    // Insert or retrieve source
    const sourceRes = await pool.query(
      `INSERT INTO sources (title, type, year, license, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [parsed.title, 'guideline', parsed.year, parsed.license]
    );

    let sourceId: string;
    if (sourceRes.rows.length > 0) {
      sourceId = sourceRes.rows[0].id;
    } else {
      const existing = await pool.query(`SELECT id FROM sources WHERE title = $1 LIMIT 1`, [parsed.title]);
      sourceId = existing.rows[0].id;
    }

    let chunkCount = 0;
    let skippedCount = 0;

    for (const sec of parsed.sections) {
      const subChunks = chunkText(sec.text);
      for (let i = 0; i < subChunks.length; i++) {
        const chunkContent = subChunks[i];
        if (!chunkContent || chunkContent.length < 20) continue;

        const hash = computeHash(chunkContent);

        // Check if hash already exists (cost control check!)
        const checkRes = await pool.query(
          `SELECT id, embedding FROM chunks WHERE hash = $1 LIMIT 1`,
          [hash]
        );

        if (checkRes.rows.length > 0 && checkRes.rows[0].embedding) {
          skippedCount++;
          continue;
        }

        const embedding = await getEmbedding(chunkContent);
        const vectorStr = `[${embedding.join(',')}]`;

        await pool.query(
          `INSERT INTO chunks (source_id, page, section, text, embedding, evidence_level, hash)
           VALUES ($1, $2, $3, $4, $5::vector, $6, $7)`,
          [sourceId, sec.page, sec.section, chunkContent, vectorStr, parsed.evidenceLevel, hash]
        );
        chunkCount++;
      }
    }

    console.log(`  -> Indexed ${chunkCount} new chunks (${skippedCount} already cached by hash).`);
  }

  console.log('Knowledge ingestion finished successfully.');
}

if (require.main === module) {
  runIngestion()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Ingestion error:', err);
      pool.end();
      process.exit(1);
    });
}
