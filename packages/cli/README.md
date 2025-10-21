# miray-cli

MIRAY CLI - Interactive command-line interface for MIRAY server.

## Installation

### Global Install (Recommended)

```bash
npm install -g miray-cli
```

After installation, you can run:

```bash
miray
```

### Local Install

```bash
npm install miray-cli
```

Then run with:

```bash
npx miray
```

## Usage

### Connect to Server

```bash
# Default (localhost:6379)
miray

# Custom host and port
miray --host localhost --port 6379

# Short flags
miray -h localhost -p 6379
```

### Interactive Session

```bash
$ miray
MIRAY CLI - Memory In-memory Real-time Async Yield
Connecting to localhost:6379...
Connected!

> PING
PONG

> PUSH user:123 "John Doe" 5m
OK

> GET user:123
"John Doe"

> TTL user:123
298

> KEYS user:*
1) "user:123"

> INFO
MIRAY Server v2 (WAL + Binary)

# Storage
keys: 1
memory: ~100 bytes
reads: 1
writes: 1
...

> FLUSH
OK

> exit
Goodbye!
```

## Commands

### Connection

- `PING` - Test server connectivity
- `INFO` - Get server information and statistics

### Data Operations

- `PUSH key value [ttl]` - Store a key-value pair
  - TTL formats: `30s`, `5m`, `2h`, `1d`
- `GET key` - Retrieve a value
- `REMOVE key` - Delete a key

### Key Management

- `KEYS pattern` - List keys matching pattern
  - `*` - All keys
  - `user:*` - Keys starting with "user:"
  - `*:active` - Keys ending with ":active"
- `TTL key` - Get remaining time-to-live in seconds
  - Returns: seconds remaining, `-1` (no expiration), or `-2` (key not found)

### Administrative

- `FLUSH` - Clear all data (use with caution!)

## Examples

### Store User Data

```bash
> PUSH user:1 '{"name":"John","age":30}' 1h
OK

> GET user:1
{"name":"John","age":30}
```

### Session Management

```bash
> PUSH session:abc '{"userId":123,"token":"xyz"}' 30m
OK

> TTL session:abc
1799

> GET session:abc
{"userId":123,"token":"xyz"}
```

### Cache Management

```bash
> PUSH cache:api:users '[{"id":1,"name":"John"}]' 5m
OK

> KEYS cache:*
1) "cache:api:users"

> REMOVE cache:api:users
1
```

### Pattern Matching

```bash
> PUSH user:1 "John"
OK
> PUSH user:2 "Jane"
OK
> PUSH product:1 "Laptop"
OK

> KEYS *
1) "user:1"
2) "user:2"
3) "product:1"

> KEYS user:*
1) "user:1"
2) "user:2"
```

## Options

- `--host`, `-h`: Server host (default: `localhost`)
- `--port`, `-p`: Server port (default: `6379`)

## Exit

To exit the CLI:
- Type `exit` or `quit`
- Press `Ctrl+C`
- Press `Ctrl+D`

## Features

- 📝 Interactive REPL
- 🎨 Syntax highlighting for responses
- ⌨️ Command history (use arrow keys)
- 🔄 Auto-reconnect on connection loss
- 📊 Real-time server statistics

## Tips

1. **Use Quotes for Values with Spaces**
   ```bash
   > PUSH key "value with spaces"
   ```

2. **JSON Data**
   ```bash
   > PUSH user '{"name":"John","active":true}'
   ```

3. **Check Before Flush**
   ```bash
   > INFO
   keys: 1000

   > FLUSH
   OK
   ```

4. **TTL Monitoring**
   ```bash
   > PUSH temp "data" 10s
   OK

   > TTL temp
   9

   # Wait a bit...
   > TTL temp
   -2
   ```

## Related Packages

- [miray-server](https://www.npmjs.com/package/miray-server) - TCP server
- [miray-client](https://www.npmjs.com/package/miray-client) - Node.js SDK

## License

MIT
