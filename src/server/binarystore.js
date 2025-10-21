import fs from 'fs';
import path from 'path';
import { pack, unpack } from 'msgpackr';

/**
 * Binary storage backend using MessagePack
 * Stores snapshots of the entire key-value store
 */
export class BinaryStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  /**
   * Save store to binary file (checkpoint)
   */
  async save(store) {
    try {
      const startTime = Date.now();
      const dir = path.dirname(this.filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Prepare data structure
      const data = {
        version: 1,
        timestamp: Date.now(),
        entries: [],
      };

      // Convert Map to array of entries
      for (const [key, entry] of store) {
        data.entries.push({
          k: key,
          v: entry.value,
          e: entry.expiresAt,
        });
      }

      // Pack with MessagePack
      const packed = pack(data);

      // Write to temp file first (atomic write)
      const tempPath = `${this.filePath}.tmp`;
      await fs.promises.writeFile(tempPath, packed);

      // Atomic rename
      await fs.promises.rename(tempPath, this.filePath);

      const duration = Date.now() - startTime;
      const sizeKB = (packed.length / 1024).toFixed(2);

      console.log(
        `[BinaryStore] Saved ${data.entries.length} entries (${sizeKB} KB) in ${duration}ms`
      );

      return { entries: data.entries.length, size: packed.length, duration };
    } catch (error) {
      console.error('[BinaryStore] Save error:', error);
      throw error;
    }
  }

  /**
   * Load store from binary file
   */
  async load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        console.log('[BinaryStore] No snapshot file found');
        return new Map();
      }

      const startTime = Date.now();

      // Read binary file
      const buffer = await fs.promises.readFile(this.filePath);

      // Unpack MessagePack
      const data = unpack(buffer);

      // Validate version
      if (data.version !== 1) {
        throw new Error(`Unsupported version: ${data.version}`);
      }

      // Rebuild Map
      const store = new Map();
      const now = Date.now();
      let loaded = 0;
      let expired = 0;

      for (const entry of data.entries) {
        // Skip expired entries
        if (entry.e && now >= entry.e) {
          expired++;
          continue;
        }

        store.set(entry.k, {
          value: entry.v,
          expiresAt: entry.e,
        });
        loaded++;
      }

      const duration = Date.now() - startTime;
      const sizeKB = (buffer.length / 1024).toFixed(2);

      console.log(
        `[BinaryStore] Loaded ${loaded} entries (${sizeKB} KB) in ${duration}ms (${expired} expired)`
      );

      return store;
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[BinaryStore] No snapshot file found');
        return new Map();
      }
      console.error('[BinaryStore] Load error:', error);
      throw error;
    }
  }

  /**
   * Get file size
   */
  async getSize() {
    try {
      const stats = await fs.promises.stat(this.filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Delete snapshot file
   */
  async delete() {
    try {
      await fs.promises.unlink(this.filePath);
      console.log('[BinaryStore] Deleted snapshot file');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('[BinaryStore] Delete error:', error);
      }
    }
  }
}
