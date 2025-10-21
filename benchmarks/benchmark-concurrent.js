import MirayClient from 'miray-client';

/**
 * Concurrent Connection Benchmark
 * Tests how many concurrent connections the server can handle
 */

class ConcurrentBenchmark {
  async run() {
    console.log('🔥 MIRAY Concurrent Connection Benchmark\n');

    // Test different connection counts
    const connectionCounts = [10, 50, 100, 200, 500, 1000];

    for (const count of connectionCounts) {
      await this.testConcurrentConnections(count);
      console.log('---\n');
    }

    console.log('✅ Benchmark complete!\n');
  }

  async testConcurrentConnections(connectionCount) {
    console.log(`📊 Testing ${connectionCount} concurrent connections...`);

    const clients = [];
    const startConnect = Date.now();

    try {
      // Create and connect all clients
      for (let i = 0; i < connectionCount; i++) {
        const client = new MirayClient({ host: 'localhost', port: 6379 });
        clients.push(client);
      }

      // Connect all in parallel
      await Promise.all(clients.map((client) => client.connect()));
      const connectTime = Date.now() - startConnect;

      console.log(`   ✅ Connected ${connectionCount} clients in ${connectTime}ms`);

      // Test 1: Parallel writes (all clients write at once)
      const writeStart = Date.now();
      const writesPerClient = 100;

      await Promise.all(
        clients.map(async (client, clientId) => {
          const promises = [];
          for (let i = 0; i < writesPerClient; i++) {
            promises.push(
              client.push(`client${clientId}:key${i}`, `value-${i}`)
            );
          }
          return Promise.all(promises);
        })
      );

      const writeDuration = Date.now() - writeStart;
      const totalWrites = connectionCount * writesPerClient;
      const writesPerSec = Math.round((totalWrites / writeDuration) * 1000);

      console.log(
        `   📝 ${totalWrites} parallel writes in ${writeDuration}ms (${writesPerSec} ops/sec)`
      );

      // Test 2: Parallel reads
      const readStart = Date.now();
      const readsPerClient = 100;

      await Promise.all(
        clients.map(async (client, clientId) => {
          const promises = [];
          for (let i = 0; i < readsPerClient; i++) {
            promises.push(client.get(`client${clientId}:key${i}`));
          }
          return Promise.all(promises);
        })
      );

      const readDuration = Date.now() - readStart;
      const totalReads = connectionCount * readsPerClient;
      const readsPerSec = Math.round((totalReads / readDuration) * 1000);

      console.log(
        `   📖 ${totalReads} parallel reads in ${readDuration}ms (${readsPerSec} ops/sec)`
      );

      // Test 3: Mixed operations (50/50 read/write)
      const mixedStart = Date.now();
      const opsPerClient = 100;

      await Promise.all(
        clients.map(async (client, clientId) => {
          const promises = [];
          for (let i = 0; i < opsPerClient; i++) {
            if (i % 2 === 0) {
              promises.push(
                client.push(`mixed${clientId}:${i}`, `value-${i}`)
              );
            } else {
              promises.push(client.get(`mixed${clientId}:${i - 1}`));
            }
          }
          return Promise.all(promises);
        })
      );

      const mixedDuration = Date.now() - mixedStart;
      const totalMixed = connectionCount * opsPerClient;
      const mixedPerSec = Math.round((totalMixed / mixedDuration) * 1000);

      console.log(
        `   🔄 ${totalMixed} mixed ops in ${mixedDuration}ms (${mixedPerSec} ops/sec)`
      );

      // Cleanup: disconnect all clients
      await Promise.all(clients.map((client) => client.disconnect()));

      console.log(`   ✅ All clients disconnected`);
    } catch (error) {
      console.error(`   ❌ Error with ${connectionCount} connections:`, error.message);

      // Emergency cleanup
      for (const client of clients) {
        try {
          client.disconnect();
        } catch {}
      }
    }
  }
}

// Run benchmark
const benchmark = new ConcurrentBenchmark();
benchmark.run();
