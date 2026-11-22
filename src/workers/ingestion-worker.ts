import { jobQueue } from '../lib/queue/job-queue';
import { ingestionPipeline, IngestionInput } from '../lib/ingestion/pipeline';

export class IngestionWorker {
  private isRunning = false;
  private pollIntervalMs: number;
  private timer: NodeJS.Timeout | null = null;

  constructor(pollIntervalMs = 2000) {
    this.pollIntervalMs = pollIntervalMs;
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[IngestionWorker] Started ingestion background worker (polling every ${this.pollIntervalMs}ms)`);

    this.loop();
  }

  stop(): void {
    console.log('[IngestionWorker] Stopping ingestion background worker...');
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private async loop(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const job = await jobQueue.fetchNextJob();
      if (job) {
        console.log(`[IngestionWorker] Processing job ${job.id} (type: ${job.input_type})...`);
        const meta = (job.metadata || {}) as Record<string, unknown>;

        const input: IngestionInput = {
          jobId: job.id,
          userId: (meta.userId as string) || '00000000-0000-0000-0000-000000000001',
          fileStorageKey: meta.fileStorageKey as string | undefined,
          fileName: meta.fileName as string | undefined,
          url: meta.url as string | undefined,
          doi: meta.doi as string | undefined,
          pmid: meta.pmid as string | undefined,
          jsonPayload: meta.jsonPayload,
          prefilledMetadata: meta.prefilledMetadata as IngestionInput['prefilledMetadata'],
          rightsConfirmed: !!meta.rightsConfirmed,
        };

        const result = await ingestionPipeline.process(input);
        console.log(`[IngestionWorker] Job ${job.id} completed successfully! Source: ${result.sourceId}, Version: ${result.versionId}`);
      }
    } catch (err) {
      console.error('[IngestionWorker] Error processing job in loop:', err);
    }

    if (this.isRunning) {
      this.timer = setTimeout(() => this.loop(), this.pollIntervalMs);
    }
  }
}

export const ingestionWorker = new IngestionWorker();
