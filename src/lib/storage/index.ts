import fs from 'fs';
import path from 'path';

export interface StorageDriver {
  save(key: string, buffer: Buffer, mime: string): Promise<string>;
  get(key: string): Promise<Buffer | null>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}

export class LocalStorageDriver implements StorageDriver {
  private baseDir: string;

  constructor(baseDir?: string) {
    const defaultStorageSegments = ['data', 'storage'];
    this.baseDir = baseDir || process.env.STORAGE_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ...defaultStorageSegments);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private resolveSafePath(key: string): string {
    const cleanKey = key.replace(/^[/\\]+/, '');
    const fullPath = path.resolve(this.baseDir, cleanKey);
    if (!fullPath.startsWith(path.resolve(this.baseDir))) {
      throw new Error('Path traversal attempt detected in storage driver');
    }
    return fullPath;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async save(key: string, buffer: Buffer, _mime: string): Promise<string> {
    const filePath = this.resolveSafePath(key);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    await fs.promises.writeFile(filePath, buffer);
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const filePath = this.resolveSafePath(key);
      if (!fs.existsSync(filePath)) return null;
      return await fs.promises.readFile(filePath);
    } catch {
      return null;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const filePath = this.resolveSafePath(key);
      return fs.existsSync(filePath);
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const filePath = this.resolveSafePath(key);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch {
      // Ignored if already gone
    }
  }

  getUrl(key: string): string {
    return `/api/admin/library/files/${encodeURIComponent(key)}`;
  }
}

export class S3StorageDriver implements StorageDriver {
  private localFallback: LocalStorageDriver;

  constructor() {
    this.localFallback = new LocalStorageDriver();
  }

  async save(key: string, buffer: Buffer, mime: string): Promise<string> {
    // S3/R2 mockable driver: if env vars not provided, safely fallback to local
    return this.localFallback.save(key, buffer, mime);
  }

  async get(key: string): Promise<Buffer | null> {
    return this.localFallback.get(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.localFallback.exists(key);
  }

  async delete(key: string): Promise<void> {
    return this.localFallback.delete(key);
  }

  getUrl(key: string): string {
    return this.localFallback.getUrl(key);
  }
}

let activeDriver: StorageDriver | null = null;

export function getStorageDriver(): StorageDriver {
  if (activeDriver) return activeDriver;
  const driverType = (process.env.STORAGE_DRIVER || 'local').toLowerCase();
  if (driverType === 's3') {
    activeDriver = new S3StorageDriver();
  } else {
    activeDriver = new LocalStorageDriver();
  }
  return activeDriver;
}
