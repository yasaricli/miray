import { config } from 'miray-common';
import { WAL } from './wal.js';
import { BinaryStore } from './binarystore.js';

/**
 * High-Performance Storage with WAL + Binary Snapshots
 *
 * Architecture:
 * 1. All writes go to WAL first (durability)
 * 2. Periodic checkpoints save binary snapshots
 * 3. WAL truncated after successful checkpoint
 * 4. On restart: load snapshot + replay WAL
 */
export class Storage {
  constructor() {
    this.store = new Map();
    this.startTime = Date.now();
    this.cleanupTimer = null;
    this.checkpointTimer = null;

    // Initialize WAL and BinaryStore
    this.wal = new WAL(config.storage.walFile);
    this.snapshot = new BinaryStore(config.storage.snapshotFile);

    // Stats
    this.stats = {
      opsTotal: 0,
      opsSinceCheckpoint: 0,
      lastCheckpoint: null,
      reads: 0,
      writes: 0,
      deletes: 0,
    };

    // WAL write queue for batching
    this.walQueue = [];
    this.walFlushTimer = null;
    this.isFlushing = false;
  }

  /**
   * Initialize storage: load snapshot + replay WAL
   */
  async init() {
    console.log('[Storage] Initializing with WAL + Binary format...');

    // Initialize WAL
    await this.wal.init();

    // Load latest snapshot
    const snapshotStore = await this.snapshot.load();
    if (snapshotStore.size > 0) {
      this.store = snapshotStore;
    }

    // Replay WAL for operations since last checkpoint
    const { store: walStore, entriesProcessed } = await this.wal.replay();

    // Merge WAL entries into store
    for (const [key, entry] of walStore) {
      this.store.set(key, entry);
    }

    if (entriesProcessed > 0) {
      console.log(`[Storage] Merged ${entriesProcessed} WAL entries`);
    }

    // Start background tasks
    this.startCleanup();
    this.startCheckpointing();

    console.log(`[Storage] Ready with ${this.store.size} keys`);
  }

  /**
   * Set a key-value pair with optional TTL
   */
  async set(key, value, ttl = null) {
    const expiresAt = ttl ? Date.now() + ttl : null;

    const entry = {
      value,
      expiresAt,
    };

    // Update in-memory store immediately
    this.store.set(key, entry);

    // Queue WAL write (batched for performance)
    await this.wal.logSet(key, value, expiresAt);

    // Update stats
    this.stats.opsTotal++;
    this.stats.opsSinceCheckpoint++;
    this.stats.writes++;
  }

  /**
   * Get a value by key
   */
  get(key) {
    this.stats.reads++;

    const entry = this.store.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      // Note: We don't log deletion to WAL here (cleanup will handle it)
      return null;
    }

    return entry.value;
  }

  /**
   * Delete a key
   */
  async delete(key) {
    // Delete from store first
    const deleted = this.store.delete(key);

    // Write to WAL
    await this.wal.logDelete(key);

    if (deleted) {
      this.stats.opsTotal++;
      this.stats.opsSinceCheckpoint++;
      this.stats.deletes++;
    }

    return deleted;
  }

  /**
   * Get all keys matching a pattern
   */
  keys(pattern = '*') {
    const regex = this.patternToRegex(pattern);
    const matchingKeys = [];

    for (const [key] of this.store) {
      // Check if expired
      const entry = this.store.get(key);
      if (entry.expiresAt && Date.now() >= entry.expiresAt) {
        continue;
      }

      if (regex.test(key)) {
        matchingKeys.push(key);
      }
    }

    return matchingKeys.sort();
  }

  /**
   * Get TTL for a key in seconds
   */
  getTTL(key) {
    const entry = this.store.get(key);

    if (!entry) {
      return null; // -2: key doesn't exist
    }

    if (!entry.expiresAt) {
      return -1; // -1: no expiration
    }

    const remaining = entry.expiresAt - Date.now();

    if (remaining <= 0) {
      this.store.delete(key);
      return null; // -2: key doesn't exist (expired)
    }

    return Math.ceil(remaining / 1000);
  }

  /**
   * Clear all data
   */
  async flush() {
    // Write to WAL
    await this.wal.logFlush();

    // Clear store
    this.store.clear();

    this.stats.opsTotal++;
    this.stats.opsSinceCheckpoint++;
  }

  /**
   * Get storage info
   */
  getInfo() {
    // Clean expired keys first
    this.cleanup();

    return {
      keys: this.store.size,
      memory: this.estimateMemory(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      opsTotal: this.stats.opsTotal,
      opsSinceCheckpoint: this.stats.opsSinceCheckpoint,
      lastCheckpoint: this.stats.lastCheckpoint,
      reads: this.stats.reads,
      writes: this.stats.writes,
      deletes: this.stats.deletes,
    };
  }

  /**
   * Convert wildcard pattern to regex
   */
  patternToRegex(pattern) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = '^' + escaped.replace(/\*/g, '.*') + '$';
    return new RegExp(regexPattern);
  }

  /**
   * Estimate memory usage
   */
  estimateMemory() {
    let bytes = 0;
    for (const [key, entry] of this.store) {
      bytes += key.length * 2;
      bytes += JSON.stringify(entry.value).length * 2;
      bytes += 16;
    }
    return bytes;
  }

  /**
   * Start cleanup timer
   */
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, config.storage.cleanupInterval);
  }

  /**
   * Remove expired keys
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];

    for (const [key, entry] of this.store) {
      if (entry.expiresAt && now >= entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.store.delete(key));

    if (keysToDelete.length > 0) {
      console.log(`[Storage] Cleaned up ${keysToDelete.length} expired keys`);
    }
  }

  /**
   * Start checkpointing timer
   */
  startCheckpointing() {
    this.checkpointTimer = setInterval(async () => {
      await this.checkpoint();
    }, config.storage.checkpointInterval);
  }

  /**
   * Create a checkpoint: save snapshot + truncate WAL
   */
  async checkpoint() {
    try {
      const startTime = Date.now();

      // Save snapshot
      const { entries, size } = await this.snapshot.save(this.store);

      // Log checkpoint marker to WAL
      await this.wal.logCheckpoint();

      // Truncate WAL (all data is in snapshot now)
      await this.wal.truncate();

      // Update stats
      this.stats.opsSinceCheckpoint = 0;
      this.stats.lastCheckpoint = new Date().toISOString();

      const duration = Date.now() - startTime;

      console.log(
        `[Storage] Checkpoint complete: ${entries} entries, ${(
          size / 1024
        ).toFixed(2)} KB, ${duration}ms`
      );
    } catch (error) {
      console.error('[Storage] Checkpoint error:', error);
    }
  }

  /**
   * Shutdown: checkpoint + close WAL
   */
  async shutdown() {
    console.log('[Storage] Shutting down...');

    // Stop timers
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }

    // Final checkpoint
    await this.checkpoint();

    // Close WAL
    await this.wal.close();

    console.log('[Storage] Shutdown complete');
  }
}
