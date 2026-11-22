import { Pool } from 'pg';
import { jobQueue } from '../queue/job-queue';
import { getStorageDriver } from '../storage';
import { validateFileSignature, computeBufferSha256, NoOpAntivirusScanner, ExtractedDocument } from './extractors';
import { PdfExtractor } from './extractors/pdf-extractor';
import { DocxExtractor } from './extractors/docx-extractor';
import { HtmlExtractor } from './extractors/html-extractor';
import { TextExtractor } from './extractors/text-extractor';
import { JsonExtractor } from './extractors/json-extractor';
import { cleanDocumentPages } from './cleaner';
import { assessExtractionQuality } from './quality';
import { structureAwareChunk } from './chunker';
import { deduplicationEngine } from './deduplication';
import { ingestionBudgetManager } from './budget';
import { CachedEmbeddingService } from './embedding-provider';
import { scanChunksForPromptInjection } from './safety-scanner';
import { computeSimhash64 } from './simhash';
import { linkAndDoiConnector } from './connectors';
import { recordAuditLog } from '@/lib/audit';

const connectionString = process.env.DATABASE_URL || 'postgresql://apple@localhost:5432/docmate';
const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

export interface IngestionInput {
  jobId: string;
  userId: string;
  fileBuffer?: Buffer;
  fileStorageKey?: string;
  fileName?: string;
  url?: string;
  doi?: string;
  pmid?: string;
  jsonPayload?: unknown;
  prefilledMetadata?: {
    title?: string;
    authors?: string[];
    year?: number;
    sourceType?: 'textbook' | 'guideline' | 'journal_article' | 'review' | 'case_report' | 'other';
    license?: string;
    evidenceLevel?: string;
  };
  rightsConfirmed: boolean;
}

export class IngestionPipeline {
  private storage = getStorageDriver();
  private antivirus = new NoOpAntivirusScanner();
  private embeddingService = new CachedEmbeddingService();

  private pdfExtractor = new PdfExtractor();
  private docxExtractor = new DocxExtractor();
  private htmlExtractor = new HtmlExtractor();
  private textExtractor = new TextExtractor();
  private jsonExtractor = new JsonExtractor();

  async process(input: IngestionInput): Promise<{ sourceId: string; versionId: string; status: string }> {
    const { jobId, userId, rightsConfirmed } = input;

    if (!rightsConfirmed) {
      await jobQueue.failJob(jobId, 'Rights confirmation is required: user must confirm rights to ingest content.');
      throw new Error('Rights confirmation required.');
    }

    try {
      // Stage 1: Receive & Validate Signature + Compute SHA256
      await jobQueue.updateProgress(jobId, 'receiving', 5);
      let buffer: Buffer;
      let originalName = input.fileName || 'document';
      let mime = 'text/plain';

      if (input.fileBuffer || input.fileStorageKey) {
        if (input.fileBuffer) {
          buffer = input.fileBuffer;
        } else {
          const loaded = await this.storage.get(input.fileStorageKey!);
          if (!loaded) {
            throw new Error(`File not found in storage: ${input.fileStorageKey}`);
          }
          buffer = loaded;
        }
        const sig = validateFileSignature(buffer, originalName);
        if (!sig.isValid) {
          throw new Error(`Unsupported or unverified file format: ${sig.detectedMime}`);
        }
        mime = sig.detectedMime;
        originalName = sig.safeName;
      } else if (input.url) {
        const resolved = await linkAndDoiConnector.fetchAndExtractUrl(input.url);
        buffer = Buffer.from(resolved.document.fullText, 'utf-8');
        mime = 'text/html';
        originalName = `${resolved.title.slice(0, 30)}.html`;
      } else if (input.doi) {
        const meta = await linkAndDoiConnector.resolveDoi(input.doi);
        const text = [meta.title, meta.authors?.join(', '), meta.abstract].filter(Boolean).join('\n\n');
        buffer = Buffer.from(text, 'utf-8');
        mime = 'text/plain';
        originalName = `doi-${input.doi.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
      } else if (input.pmid) {
        const meta = await linkAndDoiConnector.resolvePmid(input.pmid);
        const text = [meta.title, meta.authors?.join(', ')].filter(Boolean).join('\n\n');
        buffer = Buffer.from(text, 'utf-8');
        mime = 'text/plain';
        originalName = `pmid-${input.pmid}.txt`;
      } else if (input.jsonPayload) {
        buffer = Buffer.from(JSON.stringify(input.jsonPayload), 'utf-8');
        mime = 'application/json';
        originalName = 'import.json';
      } else {
        throw new Error('No input file, link, DOI, or JSON provided.');
      }

      // Antivirus Hook
      const avCheck = await this.antivirus.scan(buffer, originalName);
      if (!avCheck.clean) {
        throw new Error(`Antivirus scan failed: ${avCheck.reason || 'Malicious pattern detected'}`);
      }

      const sha256 = computeBufferSha256(buffer);

      // Save raw file into storage driver
      const storageKey = `sources/${sha256}-${originalName}`;
      await this.storage.save(storageKey, buffer, mime);

      // Record source_files row
      const fileRes = await pool.query<{ id: string }>(
        `INSERT INTO source_files (storage_key, sha256, mime, size, original_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id;`,
        [storageKey, sha256, mime, buffer.length, originalName]
      );
      const fileId = fileRes.rows[0].id;

      // Stage 2: Dedupe Level 1 & 2 (File SHA256 & Identifiers)
      await jobQueue.updateProgress(jobId, 'deduping_file', 15);
      const hashMatch = await deduplicationEngine.checkFileHash(sha256);
      if (hashMatch.isDuplicate && hashMatch.existingSourceId) {
        await jobQueue.failJob(jobId, hashMatch.message);
        throw new Error(`Duplicate detected (Level 1): ${hashMatch.message}`);
      }

      const idMatch = await deduplicationEngine.checkIdentifiers({
        doi: input.doi,
        pmid: input.pmid,
        url: input.url,
      });
      if (idMatch.isDuplicate && idMatch.existingSourceId) {
        await jobQueue.failJob(jobId, idMatch.message);
        throw new Error(`Duplicate detected (Level 2): ${idMatch.message}`);
      }

      // Stage 3: Extract text with matched extractor
      await jobQueue.updateProgress(jobId, 'extracting', 25);
      let doc: ExtractedDocument;
      if (mime === 'application/pdf') {
        doc = await this.pdfExtractor.extract(buffer, originalName);
      } else if (mime.includes('wordprocessingml') || mime.includes('msword')) {
        doc = await this.docxExtractor.extract(buffer, originalName);
      } else if (mime === 'text/html' || mime === 'application/xhtml+xml') {
        doc = await this.htmlExtractor.extract(buffer, originalName);
      } else if (mime === 'application/json') {
        doc = await this.jsonExtractor.extract(buffer, originalName);
      } else {
        doc = await this.textExtractor.extract(buffer, originalName);
      }

      // Stage 4: OCR (Feature flag check)
      await jobQueue.updateProgress(jobId, 'ocring', 35);
      // OCR hook: Tesseract ben+eng when enabled in system settings
      const { rows: ocrSettings } = await pool.query<{ value: unknown }>(
        `SELECT value FROM system_settings WHERE key = 'ingest.ocr_enabled';`
      );
      const ocrEnabled = ocrSettings[0]?.value === true || ocrSettings[0]?.value === 'true';
      if (!ocrEnabled && doc.fullText.length < 100 && doc.pageCount > 1) {
        // Document has minimal text and OCR is off -> flagged in quality check
      }

      // Stage 5: Clean Document Pages
      await jobQueue.updateProgress(jobId, 'cleaning', 45);
      const cleanedPages = cleanDocumentPages(doc.pages);

      // Stage 6: Quality Assessment & Legacy Bangla Detection
      await jobQueue.updateProgress(jobId, 'quality_check', 55);
      const qualityReport = assessExtractionQuality(cleanedPages);

      // Stage 7: Metadata Harmonization
      await jobQueue.updateProgress(jobId, 'extracting_metadata', 60);
      const title = input.prefilledMetadata?.title || doc.title;
      const authors = input.prefilledMetadata?.authors || doc.authors;
      const year = input.prefilledMetadata?.year || doc.year || new Date().getFullYear();
      const sourceType = input.prefilledMetadata?.sourceType || doc.sourceType || 'guideline';
      const license = input.prefilledMetadata?.license || doc.license || 'Open Access / Academic Demo';
      const evidenceLevel = input.prefilledMetadata?.evidenceLevel || doc.evidenceLevel || 'Ia';

      // Stage 8: Dedupe Level 3 & 4 (Fuzzy Title & Simhash Fingerprint)
      await jobQueue.updateProgress(jobId, 'deduping_metadata', 65);
      const metaMatch = await deduplicationEngine.checkContentFingerprint({
        title,
        authors,
        year,
        fullText: doc.fullText,
      });

      // Stage 9 & 10: Structure-Aware Chunking & Dedupe Level 5 (Content Hash)
      await jobQueue.updateProgress(jobId, 'chunking', 70);
      const chunksList = structureAwareChunk(title, cleanedPages);
      if (chunksList.length === 0) {
        if (doc.pageCount > 1 && doc.fullText.length < 500) {
          throw new Error(
            `Scanned Image PDF: Document contains ${doc.pageCount} pages of scanned photographic images without an embedded text layer. DocMate AI requires machine-readable text to generate verified clinical citations.`
          );
        }
        throw new Error('Chunking produced zero usable chunks. Document contains insufficient text.');
      }

      // Total token estimation
      const totalTokens = chunksList.reduce((acc, c) => acc + c.tokenCount, 0);

      // Stage 11: Cost Estimation & Daily Budget
      await jobQueue.updateProgress(jobId, 'cost_estimation', 75);
      const costEstimate = await ingestionBudgetManager.estimateCost(totalTokens);
      const budgetCheck = await ingestionBudgetManager.checkDailyBudget(costEstimate.estimatedCost);

      if (!budgetCheck.withinBudget) {
        throw new Error(
          `Daily ingestion budget exceeded. Remaining budget: $${budgetCheck.remainingBudget}, Job requires: $${costEstimate.estimatedCost}.`
        );
      }

      if (costEstimate.requiresApproval) {
        await jobQueue.pauseForApproval(jobId, costEstimate.estimatedCost, totalTokens);
        // Pauses job in awaiting_approval status
        return {
          sourceId: '',
          versionId: '',
          status: 'awaiting_approval',
        };
      }

      // Stage 12: Embeddings & Cache Storage
      await jobQueue.updateProgress(jobId, 'embedding', 80);
      // Embed non-skip and non-references chunks (references are preserved but not embedded)
      const chunksToEmbed = chunksList.filter((c) => c.kind !== 'skip' && c.kind !== 'references');
      const embeddingsMap = await this.embeddingService.getOrComputeEmbeddings(
        chunksToEmbed.map((c) => ({ contentHash: c.contentHash, text: c.embeddingText }))
      );

      // Stage 13: Database Transaction & Indexing
      await jobQueue.updateProgress(jobId, 'indexing', 90);
      const client = await pool.connect();
      let sourceId: string;
      let versionId: string;

      try {
        await client.query('BEGIN');

        // Insert or find source
        const sourceRes = await client.query<{ id: string }>(
          `INSERT INTO sources (
             title, authors, type, source_type, year, journal_or_publisher,
             doi, pmid, canonical_url, language, evidence_level, license,
             rights_confirmed_by, rights_confirmed_at, lifecycle, status
           )
           VALUES ($1, $2::jsonb, $3, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), 'in_review', 'active')
           RETURNING id;`,
          [
            title,
            JSON.stringify(authors),
            sourceType,
            year,
            doc.journalOrPublisher || null,
            input.doi || doc.doi || null,
            input.pmid || doc.pmid || null,
            input.url || doc.canonicalUrl || null,
            chunksList[0]?.language || 'mixed',
            evidenceLevel,
            license,
            userId,
          ]
        );
        sourceId = sourceRes.rows[0].id;

        // If metadata match was found at level 3 or 4, record duplicate candidate for admin review
        if (metaMatch.isDuplicate && metaMatch.existingSourceId) {
          await client.query(
            `INSERT INTO duplicate_candidates (new_source_id, existing_source_id, level, score, reason)
             VALUES ($1, $2, $3, $4, $5);`,
            [sourceId, metaMatch.existingSourceId, metaMatch.level, metaMatch.score, metaMatch.message]
          );
        }

        // Insert source_versions (Version 1)
        const textFingerprint = computeSimhash64(doc.fullText);
        const versionRes = await client.query<{ id: string }>(
          `INSERT INTO source_versions (
             source_id, version_no, change_note, file_id, text_fingerprint,
             extraction_quality, page_count, token_count, created_by
           )
           VALUES ($1, 1, 'Initial ingestion upload', $2, $3, $4, $5, $6, $7)
           RETURNING id;`,
          [sourceId, fileId, textFingerprint, qualityReport.score, doc.pageCount, totalTokens, userId]
        );
        versionId = versionRes.rows[0].id;

        await client.query(
          `UPDATE sources SET current_version_id = $1 WHERE id = $2;`,
          [versionId, sourceId]
        );

        // Stage 14: Safety Scan (Prompt Injection Defense)
        await jobQueue.updateProgress(jobId, 'safety_scanning', 95);
        const safetyReport = scanChunksForPromptInjection(
          chunksList.map((c) => ({ ordinal: c.ordinal, text: c.text }))
        );

        // Insert Chunks with English and Simple TSV configs
        for (const c of chunksList) {
          const vec = embeddingsMap.get(c.contentHash);
          const vecStr = vec ? `[${vec.join(',')}]` : null;
          const tsvConfig = c.language === 'bn' ? 'simple' : 'english';

          await client.query(
            `INSERT INTO chunks (
               source_id, source_version_id, ordinal, heading_path, page_start, page_end,
               page, section, kind, text, embedding_text, content_hash, token_count,
               language, embedding, tsv, evidence_level, status
             )
             VALUES (
               $1, $2, $3, $4, $5, $6,
               $5, $4, $7, $8, $9, $10, $11,
               $12, $13::vector, to_tsvector($14, $8), $15, 'active'
             );`,
            [
              sourceId,
              versionId,
              c.ordinal,
              c.headingPath,
              c.pageStart,
              c.pageEnd,
              c.kind,
              c.text,
              c.embeddingText,
              c.contentHash,
              c.tokenCount,
              c.language,
              vecStr,
              tsvConfig,
              evidenceLevel,
            ]
          );
        }

        // Stage 15: Finish & Mark in_review
        await recordAuditLog({
          userId,
          event: 'SOURCE_INGESTION_COMPLETED',
          payload: {
            sourceId,
            versionId,
            title,
            chunkCount: chunksList.length,
            qualityScore: qualityReport.score,
            hasPromptInjection: safetyReport.hasPromptInjection,
          },
        });

        await client.query('COMMIT');
      } catch (txErr) {
        await client.query('ROLLBACK');
        throw txErr;
      } finally {
        client.release();
      }

      await jobQueue.completeJob(jobId, {
        sourceId,
        versionId,
        qualityScore: qualityReport.score,
        warnings: qualityReport.warnings,
        warningsBn: qualityReport.warningsBn,
        needsReview: qualityReport.needsReview,
        totalTokens,
        estimatedCost: costEstimate.estimatedCost,
      });

      return {
        sourceId,
        versionId,
        status: 'in_review',
      };
    } catch (err: unknown) {
      console.error(`[IngestionPipeline] Job ${jobId} failed:`, err);
      const msg = err instanceof Error ? err.message : 'Unknown ingestion pipeline error';
      await jobQueue.failJob(jobId, msg);
      throw err;
    }
  }
}

export const ingestionPipeline = new IngestionPipeline();
