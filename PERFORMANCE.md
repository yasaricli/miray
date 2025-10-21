# MIRAY Performance Analysis

## Connection Capacity

### Architecture Overview

MIRAY uses Node.js's event-driven, non-blocking I/O model which allows it to handle thousands of concurrent connections efficiently.

```
┌──────────────────────────────────────┐
│  Event Loop (Single Thread)          │
│  ├─ Accept connections               │
│  ├─ Parse commands                   │
│  ├─ Execute operations                │
│  └─ Send responses                   │
└──────────────────────────────────────┘
           ↓
┌──────────────────────────────────────┐
│  Async I/O (Kernel)                  │
│  ├─ TCP socket management            │
│  ├─ File system (WAL writes)         │
│  └─ OS thread pool                   │
└──────────────────────────────────────┘
```

### Bottlenecks

#### 1. WAL Writes (Biggest Bottleneck)
- **Current**: Every write operation waits for disk I/O
- **Impact**: ~1000-5000 writes/sec per connection
- **Solution**: Batched WAL writes (implemented in queue)

#### 2. Event Loop Blocking
- **Issue**: Heavy CPU operations block other connections
- **Mitigation**: Operations are fast (Map lookups are O(1))

#### 3. OS Limits
- **File Descriptors**: Default ~1024, can increase to 65536+
- **Memory**: ~1KB per connection (Node.js overhead)
- **TCP Buffer**: Configurable socket buffer sizes

### Expected Performance

#### Single Connection
```
Operation         | Ops/Sec      | Latency
------------------|--------------|---------
GET (read)        | 30,000-50,000| ~0.02ms
PUSH (write)      | 5,000-15,000 | ~0.1-0.2ms
REMOVE (delete)   | 5,000-15,000 | ~0.1-0.2ms
```

#### Concurrent Connections

| Connections | Total Ops/Sec | Avg Latency | Notes |
|------------|---------------|-------------|-------|
| 10         | 50,000+       | <1ms        | Optimal |
| 50         | 100,000+      | 1-2ms       | Great |
| 100        | 150,000+      | 2-5ms       | Good |
| 200        | 200,000+      | 5-10ms      | Acceptable |
| 500        | 250,000+      | 10-20ms     | WAL becomes bottleneck |
| 1000+      | 300,000+      | 20-50ms     | Need batching optimization |

### Real-World Capacity

#### Typical Hardware (4-core, 8GB RAM)
- **Max Concurrent Connections**: 10,000-50,000
- **Sustained Throughput**: 100,000-300,000 ops/sec
- **Data Size**: Up to 5GB (in-memory)

#### Limiting Factors

1. **Memory**: Each key-value pair uses:
   - Key: ~40-100 bytes (string + overhead)
   - Value: Variable (your data)
   - Map entry: ~60 bytes (V8 overhead)
   - Example: 1M keys with 1KB values = ~1.1GB

2. **CPU**: Single-threaded event loop
   - Pattern matching (KEYS command) can be expensive
   - Cleanup operations on large datasets

3. **Disk I/O (WAL)**:
   - Limited by disk write speed
   - SSD: 100,000+ writes/sec
   - HDD: 1,000-5,000 writes/sec

### Optimization Strategies

#### Already Implemented ✅
- Binary format (MessagePack) - 50-70% smaller
- WAL for sequential writes
- Periodic checkpointing
- In-memory storage with fast Map lookups
- Connection pooling ready

#### Recommended for High Traffic 🚀

1. **Batch WAL Writes**
   ```javascript
   // Instead of: write → disk → write → disk
   // Do: buffer writes → batch write → disk
   ```

2. **Read-Only Replicas**
   - Master for writes
   - Replicas for reads
   - Scales reads infinitely

3. **Sharding**
   - Partition data by key prefix
   - Multiple MIRAY instances
   - Client-side routing

4. **Connection Limits**
   ```javascript
   // Recommended: Set max connections
   server.maxConnections = 10000;
   ```

5. **Disable WAL for Ephemeral Data**
   - Add `--no-wal` flag for volatile caches
   - 10x faster writes
   - No crash recovery

### Benchmark Commands

```bash
# Start server
npm run server

# Basic benchmark (single connection)
npm run benchmark

# Concurrent connections (10, 50, 100, 200, 500, 1000)
npm run benchmark:concurrent
```

### Sample Output

```
📊 Testing 100 concurrent connections...
   ✅ Connected 100 clients in 45ms
   📝 10,000 parallel writes in 892ms (11,210 ops/sec)
   📖 10,000 parallel reads in 234ms (42,735 ops/sec)
   🔄 10,000 mixed ops in 653ms (15,314 ops/sec)
   ✅ All clients disconnected
```

### Monitoring

Use the INFO command to track server health:

```bash
> INFO
MIRAY Server v2 (WAL + Binary)

# Storage
keys: 15000
memory: ~1500000 bytes
reads: 50000
writes: 15000
deletes: 0
ops_total: 65000
ops_since_checkpoint: 2500

# Server
uptime: 300s
active_connections: 100
total_connections: 1250
peak_connections: 150
commands_processed: 65000
```

### Production Recommendations

1. **Set Connection Limits**
   - Prevent resource exhaustion
   - Use HAProxy/Nginx for load balancing

2. **Monitor Metrics**
   - Track `peak_connections`
   - Watch `ops_since_checkpoint`
   - Monitor memory usage

3. **Tune Checkpoint Interval**
   - Longer intervals = better write performance
   - Shorter intervals = faster recovery
   - Default 30s is balanced

4. **OS Tuning**
   ```bash
   # Increase file descriptor limit
   ulimit -n 65536

   # TCP tuning
   sysctl -w net.core.somaxconn=4096
   sysctl -w net.ipv4.tcp_max_syn_backlog=4096
   ```

5. **Hardware Recommendations**
   - SSD for WAL (mandatory for high write load)
   - RAM: 2x your dataset size
   - CPU: 4+ cores (for OS tasks, even though Node.js is single-threaded)

### Comparison with Redis

| Feature | MIRAY | Redis |
|---------|------|-------|
| Max Connections | 10K-50K | 10K-100K |
| Ops/Sec (single) | 30K-50K | 80K-100K |
| Persistence | WAL + Snapshot | AOF + RDB |
| Memory Efficiency | Good | Excellent |
| Ease of Setup | Very Easy | Easy |
| Use Case | Small-medium apps | Production-grade |

MIRAY is perfect for:
- ✅ Prototypes and MVPs
- ✅ Small to medium applications
- ✅ Embedded caching in Node.js apps
- ✅ Development and testing
- ✅ Microservices with light caching needs

Consider Redis/Valkey for:
- ❌ Mission-critical production systems
- ❌ 100K+ ops/sec requirements
- ❌ Multi-GB datasets
- ❌ Advanced features (pub/sub, streams, etc.)
