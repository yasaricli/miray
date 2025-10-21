# miray-server

MIRAY TCP Server - High-performance in-memory key-value store server with WAL and binary persistence.

## Installation

### Global Install (Recommended)

```bash
npm install -g miray-server
```

After installation, you can run:

```bash
miray-server
```

### Local Install

```bash
npm install miray-server
```

Then run with:

```bash
npx miray-server
```

## Usage

### Start Server

```bash
# Default (localhost:6379)
miray-server

# Custom host and port
miray-server --host 0.0.0.0 --port 6379

# Short flags
miray-server -h 0.0.0.0 -p 6379
```

### Options

- `--host`, `-h`: Host address (default: `0.0.0.0`)
- `--port`, `-p`: Port number (default: `6379`)

## Features

- ✨ High-performance TCP server
- 🔒 WAL (Write-Ahead Log) for crash safety
- 📦 Binary persistence with MessagePack
- ⏱️ TTL support for keys
- 🔄 Automatic checkpointing
- 🧹 Automatic cleanup of expired keys
- 📊 Built-in metrics and monitoring

## Server Output

```bash
$ miray-server
[Storage] Initializing with WAL + Binary format...
[WAL] Initialized at ./data/miray.wal
[Storage] Ready with 0 keys
[Server] MIRAY listening on 0.0.0.0:6379
```

## Configuration

The server uses configuration from `miray-common` package. Default settings:

```javascript
{
  server: {
    host: '0.0.0.0',
    port: 6379,
  },
  storage: {
    walFile: './data/miray.wal',
    snapshotFile: './data/miray.snapshot',
    checkpointInterval: 30000,  // 30 seconds
    cleanupInterval: 1000,      // 1 second
  }
}
```

## Data Files

The server creates the following files:

- `./data/miray.wal` - Write-ahead log
- `./data/miray.snapshot` - Binary snapshot

## Graceful Shutdown

Press `Ctrl+C` to gracefully shutdown the server. It will:

1. Stop accepting new connections
2. Close existing connections
3. Save checkpoint
4. Close WAL file

## Client Connections

Connect to the server using:

- **CLI**: `npm install -g miray-cli` then run `miray`
- **Node.js SDK**: `npm install miray-client`
- **TCP**: Any TCP client on port 6379

## Commands

Supported commands:
- `PING` - Test connection
- `PUSH key value [ttl]` - Store key-value
- `GET key` - Retrieve value
- `REMOVE key` - Delete key
- `KEYS pattern` - List keys
- `TTL key` - Get remaining TTL
- `FLUSH` - Clear all data
- `INFO` - Server statistics

## Performance

Expected performance on typical hardware:

- **Connections**: 10K-50K concurrent
- **Throughput**: 100K-300K ops/sec
- **Latency**: <1ms for reads, 1-5ms for writes

## Related Packages

- [miray-cli](https://www.npmjs.com/package/miray-cli) - Interactive CLI
- [miray-client](https://www.npmjs.com/package/miray-client) - Node.js SDK

## License

MIT
