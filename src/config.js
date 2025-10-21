export const config = {
  server: {
    host: '0.0.0.0',
    port: 7779,
  },
  storage: {
    // Binary + WAL system
    walFile: './data/miray.wal',
    snapshotFile: './data/miray.snapshot',
    checkpointInterval: 30000, // 30 seconds
    cleanupInterval: 1000, // 1 second
  },
};
