# MIRAY ✨

**M**emory **I**n-memory **R**eal-time **A**sync **Y**ield

A high-performance, TCP-based in-memory key-value store built with Node.js. MIRAY provides production-grade storage with WAL (Write-Ahead Log), binary persistence, and automatic checkpointing.

> 💝 **Named after Miray** - This project is lovingly named after my daughter, Miray. Just as she brings light and joy to our lives, this project aims to bring simplicity and performance to in-memory data storage.

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
└── lerna.json            # Lerna configuration
```

## Packages

### [miray-server](./packages/server)
High-performance TCP server with WAL and binary persistence.

### [miray-client](./packages/client)
Node.js SDK for connecting to MIRAY server.

### [miray-cli](./packages/cli)
Interactive REPL for MIRAY server.

### [miray-common](./packages/common)
Shared configuration and utilities.

## Quick Start

### Installation

```bash
# Clone repository
git clone <repository-url>
cd miray

# Install dependencies
npm install
```

### Running the Server

```bash
# Start MIRAY server
npm run server

# Or with custom port
node packages/server/src/index.js --port 7779
```

### Using the CLI

```bash
# Start interactive CLI
npm run cli

# Example session
> PING
PONG

> PUSH user:123 "John Doe" 5m
OK

> GET user:123
"John Doe"

> INFO
MIRAY Server v2 (WAL + Binary)
...
```

### Using the Client SDK

```bash
# Install in your project
npm install miray-client
```

```javascript
import MirayClient from 'miray-client';

const client = new MirayClient({
  host: 'localhost',
  port: 7779
});

await client.connect();

// Store data with TTL
await client.push('session:abc', { userId: 123 }, '5m');

// Retrieve data
const session = await client.get('session:abc');
console.log(session); // { userId: 123 }

// Clean up
await client.disconnect();
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

## Development

### Quick Commands (using Make)

```bash
# Show all available commands
make help

# Install dependencies
make install

# Clean everything
make clean          # Remove node_modules
make clean-data     # Remove runtime data (*.wal, *.snapshot)
make clean-all      # Clean everything

# Development
make server         # Start MIRAY server
make server-dev     # Start with auto-reload
make cli            # Start CLI

# Benchmarks
make benchmark                # Single connection benchmark
make benchmark-concurrent     # Concurrent connections test

# Testing & Building
make test           # Run tests
make build          # Build all packages

# Publishing
make version        # Version bump
make publish        # Publish to npm
```

### NPM Scripts

```bash
# Install dependencies
npm install

# Development
npm run server                # Start server
npm run server:dev           # Start server with auto-reload
npm run cli                  # Start CLI

# Benchmarks
npm run benchmark            # Single connection
npm run benchmark:concurrent # Concurrent test

# Maintenance
npm run clean                # Remove node_modules
npm run clean:data          # Remove runtime data
npm run build               # Build all packages
npm run test                # Run tests

# Publishing (Lerna)
npm run version             # Bump version
npm run publish             # Publish packages
```

## Benchmarks

### Single Connection Performance
```bash
npm run benchmark
```

Expected results:
- **Reads**: 30,000-50,000 ops/sec
- **Writes**: 5,000-15,000 ops/sec
- **Mixed**: 7,000-20,000 ops/sec

### Concurrent Connections
```bash
npm run benchmark:concurrent
```

Tests with 10, 50, 100, 200, 500, 1000 concurrent connections.

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

## Data Files

```
data/
├── miray.wal        # Write-ahead log (append-only)
└── miray.snapshot   # Binary snapshot (MessagePack)
```

## Configuration

Edit `packages/common/src/config.js`:

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

## Performance

See [PERFORMANCE.md](./PERFORMANCE.md) for detailed performance analysis and optimization strategies.

**TL;DR**: MIRAY can handle:
- 10,000-50,000 concurrent connections
- 100,000-300,000 operations per second
- Datasets up to several GB

## Commands

| Command | Description | Example |
|---------|-------------|---------|
| `PING` | Test server connectivity | `PING` → `PONG` |
| `PUSH key value [ttl]` | Store key-value pair | `PUSH user:1 "John" 5m` |
| `GET key` | Retrieve value | `GET user:1` |
| `REMOVE key` | Delete key | `REMOVE user:1` |
| `KEYS pattern` | List matching keys | `KEYS user:*` |
| `TTL key` | Get remaining TTL | `TTL user:1` |
| `FLUSH` | Clear all data | `FLUSH` |
| `INFO` | Server statistics | `INFO` |

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
