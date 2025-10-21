import MirayClient from 'miray-client';

/**
 * Benchmark script for MIRAY storage performance
 */

class Benchmark {
  constructor() {
    this.client = new MirayClient({ host: 'localhost', port: 7779 });
  }

  async run() {
    console.log('🚀 MIRAY Performance Benchmark\n');

    try {
      await this.client.connect();
      console.log('✅ Connected to MIRAY server\n');

      // Test 1: Write Performance
      await this.testWrites();

      // Test 2: Read Performance
      await this.testReads();

      // Test 3: Mixed Operations
      await this.testMixed();

      // Test 4: TTL Operations
      await this.testTTL();

      // Show server info
      await this.showInfo();

      await this.client.disconnect();
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    }
  }

  async testWrites() {
    console.log('📝 Write Performance Test');
    console.log('Writing 10,000 key-value pairs...');

    const startTime = Date.now();
    const count = 10000;

    for (let i = 0; i < count; i++) {
      await this.client.push(`key:${i}`, `value-${i}`);
    }

    const duration = Date.now() - startTime;
    const opsPerSec = Math.round((count / duration) * 1000);

    console.log(`✅ Completed in ${duration}ms`);
    console.log(`   ${opsPerSec} writes/sec`);
    console.log(`   ${(duration / count).toFixed(2)}ms per write\n`);
  }

  async testReads() {
    console.log('📖 Read Performance Test');
    console.log('Reading 10,000 keys...');

    const startTime = Date.now();
    const count = 10000;

    for (let i = 0; i < count; i++) {
      await this.client.get(`key:${i}`);
    }

    const duration = Date.now() - startTime;
    const opsPerSec = Math.round((count / duration) * 1000);

    console.log(`✅ Completed in ${duration}ms`);
    console.log(`   ${opsPerSec} reads/sec`);
    console.log(`   ${(duration / count).toFixed(2)}ms per read\n`);
  }

  async testMixed() {
    console.log('🔄 Mixed Operations Test');
    console.log('10,000 mixed operations (50% read, 50% write)...');

    const startTime = Date.now();
    const count = 10000;

    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        await this.client.push(`mixed:${i}`, `value-${i}`);
      } else {
        await this.client.get(`mixed:${i - 1}`);
      }
    }

    const duration = Date.now() - startTime;
    const opsPerSec = Math.round((count / duration) * 1000);

    console.log(`✅ Completed in ${duration}ms`);
    console.log(`   ${opsPerSec} ops/sec`);
    console.log(`   ${(duration / count).toFixed(2)}ms per operation\n`);
  }

  async testTTL() {
    console.log('⏱️  TTL Performance Test');
    console.log('Writing 1,000 keys with TTL...');

    const startTime = Date.now();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      await this.client.push(`ttl:${i}`, `value-${i}`, '5m');
    }

    const duration = Date.now() - startTime;
    const opsPerSec = Math.round((count / duration) * 1000);

    console.log(`✅ Completed in ${duration}ms`);
    console.log(`   ${opsPerSec} TTL writes/sec\n`);
  }

  async showInfo() {
    console.log('📊 Server Information');
    const info = await this.client.info();
    console.log(info);
  }
}

// Run benchmark
const benchmark = new Benchmark();
benchmark.run();
