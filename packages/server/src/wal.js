import fs from 'fs';
import path from 'path';
import { pack, unpack } from 'msgpackr';

/**
 * Write-Ahead Log (WAL) for crash recovery and durability
 *
 * Format:
 * Each entry: [type, timestamp, key, value?, expiresAt?]
 * Types: 1=SET, 2=DELETE, 3=FLUSH, 4=CHECKPOINT
 */
export class WAL {
  constructor(filePath) {
    this.filePath = filePath;
    this.fd = null;
    this.writeBuffer = [];
    this.flushTimer = null;
  }

  /**
   * Initialize WAL file
   */
  async init() {
    const dir = path.dirname(this.filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open file in append mode
    this.fd = await fs.promises.open(this.filePath, 'a+');
    console.log(`[WAL] Initialized at ${this.filePath}`);
  }

  /**
   * Write a SET operation to WAL
   */
  async logSet(key, value, expiresAt = null) {
    const entry = [1, Date.now(), key, value, expiresAt];
    await this.writeEntry(entry);
  }

  /**
   * Write a DELETE operation to WAL
   */
  async logDelete(key) {
    const entry = [2, Date.now(), key];
    await this.writeEntry(entry);
  }

  /**
   * Write a FLUSH operation to WAL
   */
  async logFlush() {
    const entry = [3, Date.now()];
    await this.writeEntry(entry);
  }

  /**
   * Write a CHECKPOINT marker to WAL
   */
  async logCheckpoint() {
    const entry = [4, Date.now()];
    await this.writeEntry(entry);
  }

  /**
   * Write entry to WAL
   */
  async writeEntry(entry) {
    try {
      // Pack entry with msgpack
      const packed = pack(entry);

      // Write length prefix (4 bytes) + data
      const lengthBuffer = Buffer.allocUnsafe(4);
      lengthBuffer.writeUInt32BE(packed.length, 0);

      await this.fd.write(lengthBuffer);
      await this.fd.write(packed);

      // Force sync to disk for durability (optional, can batch)
      // await this.fd.sync();
    } catch (error) {
      console.error('[WAL] Write error:', error);
      throw error;
    }
  }

  /**
   * Replay WAL to recover state
   * Returns: Map of recovered entries
   */
  async replay() {
    const store = new Map();
    let entriesProcessed = 0;
    let lastCheckpointPos = 0;

    try {
      // Read entire WAL file
      const stats = await fs.promises.stat(this.filePath);
      if (stats.size === 0) {
        console.log('[WAL] Empty WAL file, starting fresh');
        return { store, entriesProcessed };
      }

      const fileHandle = await fs.promises.open(this.filePath, 'r');
      let position = 0;

      while (position < stats.size) {
        // Read length prefix (4 bytes)
        const lengthBuffer = Buffer.allocUnsafe(4);
        const { bytesRead: lengthRead } = await fileHandle.read(
          lengthBuffer,
          0,
          4,
          position
        );

        if (lengthRead < 4) break;

        const entryLength = lengthBuffer.readUInt32BE(0);
        position += 4;

        // Read entry data
        const entryBuffer = Buffer.allocUnsafe(entryLength);
        const { bytesRead: dataRead } = await fileHandle.read(
          entryBuffer,
          0,
          entryLength,
          position
        );

        if (dataRead < entryLength) break;

        position += entryLength;

        // Unpack entry
        try {
          const entry = unpack(entryBuffer);
          const [type, timestamp, key, value, expiresAt] = entry;

          switch (type) {
            case 1: // SET
              store.set(key, { value, expiresAt });
              entriesProcessed++;
              break;

            case 2: // DELETE
              store.delete(key);
              entriesProcessed++;
              break;

            case 3: // FLUSH
              store.clear();
              entriesProcessed++;
              break;

            case 4: // CHECKPOINT
              lastCheckpointPos = position;
              break;
          }
        } catch (parseError) {
          console.error('[WAL] Parse error at position', position, parseError);
          // Skip corrupted entry
        }
      }

      await fileHandle.close();

      console.log(
        `[WAL] Replayed ${entriesProcessed} entries (file size: ${stats.size} bytes)`
      );

      // Clean expired entries
      const now = Date.now();
      let expiredCount = 0;
      for (const [key, entry] of store) {
        if (entry.expiresAt && now >= entry.expiresAt) {
          store.delete(key);
          expiredCount++;
        }
      }

      if (expiredCount > 0) {
        console.log(`[WAL] Removed ${expiredCount} expired entries during replay`);
      }

      return { store, entriesProcessed, lastCheckpointPos };
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('[WAL] No WAL file found, starting fresh');
        return { store, entriesProcessed: 0 };
      }
      console.error('[WAL] Replay error:', error);
      throw error;
    }
  }

  /**
   * Truncate WAL after checkpoint
   */
  async truncate() {
    try {
      await this.fd.truncate(0);
      console.log('[WAL] Truncated after checkpoint');
    } catch (error) {
      console.error('[WAL] Truncate error:', error);
    }
  }

  /**
   * Close WAL file
   */
  async close() {
    if (this.fd) {
      await this.fd.sync();
      await this.fd.close();
      this.fd = null;
      console.log('[WAL] Closed');
    }
  }

  /**
   * Get WAL file size
   */
  async getSize() {
    try {
      const stats = await fs.promises.stat(this.filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }
}
