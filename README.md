# MIRAY ✨

<img width="231" height="224" alt="icon" src="https://github.com/user-attachments/assets/3bcd9716-2c42-47cf-b06c-199e9cfae8ce" />


**M**emory **I**n-memory **R**apid **A**sync **Y**ield

A high-performance, TCP-based in-memory key-value store built with Node.js. MIRAY provides production-grade storage with WAL (Write-Ahead Log), binary persistence, and automatic checkpointing.

> 💝 **Named after Miray** - This project is lovingly named after my daughter, Miray. Just as she brings light and joy to our lives, this project aims to bring simplicity and performance to in-memory data storage.

## Why MIRAY?

In modern application development, you often need a fast, temporary storage solution for:

- **Session Management**: Store user sessions with automatic expiration
- **Caching**: Speed up your applications by caching frequently accessed data
- **Rate Limiting**: Track API usage with time-based limits
- **Temporary State**: Store temporary application state across services
- **Feature Flags**: Dynamic feature toggles with TTL support

While Redis is a popular choice, MIRAY offers a **lightweight, Node.js-native alternative** that:

- ✅ **Zero configuration** - Works out of the box with sensible defaults
- ✅ **Native JavaScript** - Built with Node.js, no C bindings or external dependencies
- ✅ **Crash-safe** - Write-Ahead Log ensures your data survives crashes
- ✅ **Developer-friendly** - Simple API, easy to understand and extend
- ✅ **Production-ready** - Handles 100K+ ops/sec with persistence

Perfect for microservices, serverless applications, or any Node.js project needing fast temporary storage.

## Installation

### Global Installation (Recommended)

Install MIRAY globally to use the server and CLI anywhere:

```bash
npm install -g miray-server miray-cli
```

### For JavaScript Applications

Install the client library in your project:

```bash
npm install miray-client
```

### Using Docker

Run MIRAY server using Docker (pulls latest from npm):

```bash
# Pull the image
docker pull yasaricli/miray-server

# Run without authentication
docker run -d --name miray-server -p 7779:7779 yasaricli/miray-server

# Run with authentication
docker run -d --name miray-server -p 7779:7779 -e USERNAME=admin -e PASSWORD=secret123 yasaricli/miray-server

# Run with persistent data
docker run -d --name miray-server -p 7779:7779  -v miray-data:/app/data yasaricli/miray-server
```

The Dockerfile:
- Installs the latest `miray-server` from npm
- Uses Alpine Linux for minimal size (~50MB)
- Runs as non-root user for security
- Supports environment variables: `PORT`, `HOST`, `USERNAME`, `PASSWORD`
- Includes proper signal handling with dumb-init


## Quick Start

### 1. Start the Server

```bash
# Start MIRAY server (default port: 7779)
miray-server

# Or with custom port
miray-server --port 8000

# Or with authentication (username:password)
miray-server --username admin --password secret123
```

You should see:
```
MIRAY Server starting...
Listening on 0.0.0.0:7779
Authentication disabled (no credentials provided)
```

Or with authentication enabled:
```
MIRAY Server starting...
Listening on 0.0.0.0:7779
Authentication enabled (username: admin)
```

### 2. Use the CLI

Open a new terminal and start the interactive CLI:

```bash
# Connect to server without authentication
miray-cli

# Or connect to specific host/port
miray-cli --host localhost --port 8000

# Or connect with authentication
miray-cli --username admin --password secret123
```

Try these commands:

```bash
> HELP
# Shows all available commands

> PING
PONG

> PUSH user:123 "John Doe" 5m
OK

> GET user:123
"John Doe"

> KEYS user:*
1) "user:123"

> TTL user:123
299000  # milliseconds remaining

> INFO
MIRAY Server (WAL + Binary)
# Storage
keys: 1
memory: ~50 bytes
...
```

### 3. Use in Your JavaScript Application

Install the client:

```bash
npm install miray-client
```

Basic usage:

```javascript
import MirayClient from 'miray-client';

// Without authentication
const client = new MirayClient({
  host: 'localhost',
  port: 7779
});

// Or with authentication
const clientWithAuth = new MirayClient({
  host: 'localhost',
  port: 7779,
  username: 'admin',
  password: 'secret123'
});

// Connect to server (automatically authenticates if credentials provided)
await client.connect();

// Store data
await client.push('user:123', 'John Doe');
await client.push('session:abc', { userId: 123, role: 'admin' }, '30m');

// Retrieve data
const user = await client.get('user:123');
console.log(user); // "John Doe"

const session = await client.get('session:abc');
console.log(session); // { userId: 123, role: 'admin' }

// Remove data
await client.remove('user:123');

// Batch operations
await client.mPush(['key1', 'value1', 'key2', 'value2']);
const values = await client.mGet(['key1', 'key2']);

// Get all keys matching pattern
const userKeys = await client.keys('user:*');

// Clean up
await client.disconnect();
```

### Real-World Examples

#### Session Management

```javascript
import MirayClient from 'miray-client';

const sessionStore = new MirayClient();
await sessionStore.connect();

// Store session with 1 hour expiration
async function createSession(userId, sessionData) {
  const sessionId = generateSessionId();
  await sessionStore.push(
    `session:${sessionId}`,
    { userId, ...sessionData },
    '1h'
  );
  return sessionId;
}

// Get session
async function getSession(sessionId) {
  return await sessionStore.get(`session:${sessionId}`);
}

// Extend session
async function extendSession(sessionId) {
  const session = await sessionStore.get(`session:${sessionId}`);
  if (session) {
    await sessionStore.push(`session:${sessionId}`, session, '1h');
  }
}
```

#### API Rate Limiting

```javascript
import MirayClient from 'miray-client';

const rateLimiter = new MirayClient();
await rateLimiter.connect();

async function checkRateLimit(apiKey, maxRequests = 100) {
  const key = `ratelimit:${apiKey}`;
  const current = await rateLimiter.get(key);

  if (!current) {
    // First request in this minute
    await rateLimiter.push(key, '1', '1m');
    return { allowed: true, remaining: maxRequests - 1 };
  }

  const count = parseInt(current, 10);
  if (count >= maxRequests) {
    const ttl = await rateLimiter.ttl(key);
    return { allowed: false, resetIn: ttl };
  }

  await rateLimiter.push(key, String(count + 1), '1m');
  return { allowed: true, remaining: maxRequests - count - 1 };
}
```

#### Cache Layer

```javascript
import MirayClient from 'miray-client';

const cache = new MirayClient();
await cache.connect();

async function getUser(userId) {
  const cacheKey = `user:${userId}`;

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Cache miss - fetch from database
  const user = await db.users.findById(userId);

  // Store in cache for 5 minutes
  await cache.push(cacheKey, user, '5m');

  return user;
}
```

## Features

- ✨ **High Performance**: 100K+ ops/sec with concurrent connections
- 🔒 **Crash-Safe**: Write-Ahead Log ensures data durability
- 📦 **Binary Storage**: MessagePack format (50-70% smaller than JSON)
- ⏱️ **TTL Support**: Automatic expiration (30s, 5m, 2h, 1d)
- 🔄 **Auto Checkpointing**: Periodic snapshots with WAL compaction
- 🧹 **Auto Cleanup**: Expired keys are automatically removed
- 🎯 **Pattern Matching**: Wildcard key queries (KEYS user:*)
- 📊 **Monitoring**: Built-in metrics and connection tracking
- 🚀 **Batch Operations**: MGET, MPUSH, MREMOVE for better performance

## Authentication

MIRAY supports optional username/password authentication to secure your server.

### Server with Authentication

```bash
# Start server with authentication
miray-server --username admin --password secret123
```

When authentication is enabled:
- All clients must authenticate before executing commands
- Unauthenticated clients will receive `-ERR NOAUTH Authentication required`
- Only the `AUTH` command works before authentication

### Client Authentication

**CLI:**
```bash
miray-cli --username admin --password secret123
```

**JavaScript Client:**
```javascript
const client = new MirayClient({
  host: 'localhost',
  port: 7779,
  username: 'admin',
  password: 'secret123'
});

await client.connect(); // Automatically authenticates
```

**Manual AUTH Command:**
```bash
> AUTH admin secret123
OK Authenticated
```

## Available Commands

| Command | Description | Example |
|---------|-------------|---------|
| `PING` | Test server connectivity | `PING` → `PONG` |
| `HELP` | Show all available commands | `HELP` |
| `AUTH user pass` | Authenticate (if auth enabled) | `AUTH admin secret123` |
| `PUSH key value [ttl]` | Store key-value pair | `PUSH user:1 "John" 5m` |
| `GET key` | Retrieve value | `GET user:1` |
| `REMOVE key` | Delete key | `REMOVE user:1` |
| `KEYS pattern` | List matching keys | `KEYS user:*` |
| `TTL key` | Get remaining TTL in ms | `TTL user:1` |
| `FLUSH` | Clear all data | `FLUSH` |
| `INFO` | Server statistics | `INFO` |
| `MGET key1 key2 ...` | Get multiple values | `MGET user:1 user:2` |
| `MPUSH key1 val1 ...` | Set multiple pairs | `MPUSH k1 v1 k2 v2` |
| `MREMOVE key1 key2 ...` | Delete multiple keys | `MREMOVE k1 k2` |

## Configuration

The server can be configured via command-line arguments or by editing `packages/common/src/config.js`:

### Command-Line Options

```bash
miray-server --port 8000 --host 127.0.0.1
```

### Configuration File

```javascript
export const config = {
  server: {
    host: '0.0.0.0',
    port: 7779,
  },
  storage: {
    walFile: './data/miray.wal',
    snapshotFile: './data/miray.snapshot',
    checkpointInterval: 30000,  // 30 seconds
    cleanupInterval: 1000,      // 1 second
  },
};
```

## Architecture

```
┌──────────────┐
│   Client     │  (miray-client, miray-cli)
│   Packages   │
└──────┬───────┘
       │ TCP
       ▼
┌──────────────┐
│  miray-     │
│  server      │
└──────┬───────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌─────────────┐ ┌──────────────┐
│ WAL (write  │ │  Snapshot    │
│  ahead log) │ │  (binary)    │
└─────────────┘ └──────────────┘
```

### Data Files

```
data/
├── miray.wal        # Write-ahead log (append-only)
└── miray.snapshot   # Binary snapshot (MessagePack)
```

## Performance

**TL;DR**: MIRAY delivers excellent performance for a Node.js-native in-memory store:

- 🚀 **100K+ ops/sec** with 50-100 concurrent clients
- ⚡ **11K reads/sec, 6K writes/sec** (single connection)
- 📊 **Peak: 143K reads/sec** (100 concurrent clients)
- 🎯 **Sub-millisecond latency** (<0.2ms average)
- 🔄 **Scales to 1000+ connections** (35K ops/sec)

### Quick Benchmark

```bash
# Single connection test
npm run benchmark

# Concurrent connections test
npm run benchmark:concurrent
```

### Detailed Performance Analysis

For comprehensive performance metrics, optimization strategies, and real-world capacity planning, see:

📖 **[PERFORMANCE.md](./PERFORMANCE.md)** - Complete performance analysis including:
- Detailed benchmark results
- Scalability analysis
- Docker performance impact
- Comparison with Redis
- Tuning recommendations
- Monitoring guide

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

## Monorepo Structure

This project uses Lerna for managing multiple packages:

```
miray/
├── packages/
│   ├── miray-common      # Shared configuration and utilities
│   ├── miray-server      # TCP server implementation
│   ├── miray-client      # Node.js SDK client
│   └── miray-cli         # Interactive command-line interface
├── benchmarks/            # Performance benchmarks
├── Dockerfile            # Docker image definition
└── lerna.json            # Lerna configuration
```

### Packages

#### [miray-server](./packages/server)
High-performance TCP server with WAL and binary persistence.

#### [miray-client](./packages/client)
Node.js SDK for connecting to MIRAY server.

#### [miray-cli](./packages/cli)
Interactive REPL for MIRAY server.

#### [miray-common](./packages/common)
Shared configuration and utilities.

## Publishing Packages

```bash
# Publish all changed packages
npx lerna publish

# Publish specific version
npx lerna publish minor
npx lerna publish major
```

## Contributing

1. Create a feature branch
2. Make changes in relevant package
3. Test with `npm run test`
4. Submit pull request

## License

MIT

---

Made with ❤️ for **Miray**
