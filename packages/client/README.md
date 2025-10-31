# miray-client

MIRAY Client SDK - Node.js client library for connecting to MIRAY server.

## Installation

```bash
npm install miray-client
```

## Quick Start

```javascript
import { MirayClient } from 'miray-client';

const client = new MirayClient({
  host: 'localhost',
  port: 7779
});

// Auto-connects on creation
await client.push('user:123', { name: 'John', age: 30 }, '5m');

// Retrieve data
const user = await client.get('user:123');
console.log(user); // { name: 'John', age: 30 }

// Optional: event handlers for connection status
client
  .onConnect(() => console.log('Connected!'))
  .onError((error) => console.log('Error:', error.message));

// Disconnect when done
client.disconnect();
```

## API Reference

### Constructor

```javascript
new MirayClient(options)
```

**Options:**
- `host` (string): Server host (default: `'localhost'`)
- `port` (number): Server port (default: `7779`)
- `username` (string, optional): Authentication username
- `password` (string, optional): Authentication password

**Returns:** MirayClient instance that auto-connects

### Event Handler Methods

#### `onConnect(callback): MirayClient`

Set connection success handler (chainable).

```javascript
client.onConnect(() => {
  console.log('Connected and ready!');
});
```

#### `onError(callback): MirayClient`

Set error handler (chainable).

```javascript
client.onError((error) => {
  console.error('Error:', error.message);
});
```

#### `onDisconnect(callback): MirayClient`

Set disconnect handler (chainable).

```javascript
client.onDisconnect(() => {
  console.log('Connection lost');
});
```

### Utility Methods

#### `isReady(): boolean`

Check if client is ready for operations.

```javascript
if (client.isReady()) {
  // Ready to send commands
}
```

#### `waitForReady(timeout?): Promise<void>`

Wait for client to be ready (optional - commands auto-wait).

```javascript
await client.waitForReady(5000); // Wait max 5 seconds
```

#### `disconnect(): void`

Disconnect from the server.

```javascript
client.disconnect();
```

### Data Commands

#### `ping(): Promise<boolean>`

Test server connectivity.

```javascript
const isAlive = await client.ping(); // true
```

#### `push(key, value, ttl?): Promise<boolean>`

Store a key-value pair with optional TTL.

**Parameters:**
- `key` (string): Key name
- `value` (any): Value (will be JSON serialized if object)
- `ttl` (string, optional): Time to live (e.g., '30s', '5m', '2h', '1d')

```javascript
await client.push('session:abc', { userId: 123 }, '1h');
await client.push('counter', 42);
```

#### `get(key, parse?): Promise<any>`

Retrieve a value by key.

**Parameters:**
- `key` (string): Key name
- `parse` (boolean, optional): Auto-parse JSON (default: `true`)

```javascript
const session = await client.get('session:abc');
const rawValue = await client.get('session:abc', false);
```

#### `remove(key): Promise<boolean>`

Delete a key.

```javascript
const deleted = await client.remove('session:abc'); // true or false
```

#### `keys(pattern?): Promise<string[]>`

Get all keys matching a pattern.

**Parameters:**
- `pattern` (string, optional): Wildcard pattern (default: `'*'`)

```javascript
const allKeys = await client.keys();
const userKeys = await client.keys('user:*');
```

#### `ttl(key): Promise<number>`

Get remaining TTL in seconds.

**Returns:**
- Positive number: Remaining seconds
- `-1`: Key exists but has no expiration
- `-2`: Key doesn't exist

```javascript
const remaining = await client.ttl('session:abc'); // 178
```

#### `flush(): Promise<boolean>`

Clear all data.

```javascript
await client.flush();
```

#### `info(): Promise<string>`

Get server information.

```javascript
const info = await client.info();
console.log(info);
// MIRAY Server v2 (WAL + Binary)
// keys: 42
// memory: ~8192 bytes
// ...
```

## Examples

### Session Management

```javascript
import { MirayClient } from 'miray-client';

class SessionManager {
  constructor() {
    // Auto-connects on creation
    this.client = new MirayClient()
      .onConnect(() => console.log('📡 Session manager ready'))
      .onError((error) => console.error('❌ Connection error:', error.message));
  }

  async createSession(sessionId, userData) {
    await this.client.push(`session:${sessionId}`, userData, '1h');
  }

  async getSession(sessionId) {
    return await this.client.get(`session:${sessionId}`);
  }

  async deleteSession(sessionId) {
    return await this.client.remove(`session:${sessionId}`);
  }

  cleanup() {
    this.client.disconnect();
  }
}

// Usage - much simpler!
const manager = new SessionManager();
await manager.createSession('abc123', { userId: 1, email: 'user@example.com' });
const session = await manager.getSession('abc123');
manager.cleanup();
```

### Caching

```javascript
import { MirayClient } from 'miray-client';

class Cache {
  constructor() {
    // Auto-connects - no init() needed!
    this.client = new MirayClient();
  }

  async set(key, value, ttl = '5m') {
    await this.client.push(key, value, ttl);
  }

  async get(key) {
    return await this.client.get(key);
  }

  async getOrSet(key, fetchFn, ttl = '5m') {
    let value = await this.get(key);

    if (value === null) {
      value = await fetchFn();
      await this.set(key, value, ttl);
    }

    return value;
  }

  async invalidate(pattern) {
    const keys = await this.client.keys(pattern);
    for (const key of keys) {
      await this.client.remove(key);
    }
  }
}

// Usage - instant, no setup!
const cache = new Cache();

// Cache expensive operation immediately
const data = await cache.getOrSet('api:users', async () => {
  return await fetch('/api/users').then(r => r.json());
}, '10m');
```

### Connection Pool

```javascript
import { MirayClient } from 'miray-client';

class ConnectionPool {
  constructor(size = 10) {
    this.size = size;
    this.pool = [];
    this.available = [];

    // Auto-create pool
    this.init();
  }

  async init() {
    for (let i = 0; i < this.size; i++) {
      // Auto-connects on creation
      const client = new MirayClient();
      this.pool.push(client);
      this.available.push(client);
    }
  }

  async acquire() {
    if (this.available.length === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return this.acquire();
    }
    return this.available.pop();
  }

  release(client) {
    this.available.push(client);
  }

  shutdown() {
    for (const client of this.pool) {
      client.disconnect();
    }
  }
}
```

## Events

The client extends `EventEmitter` and emits the following events:

```javascript
client.on('connect', () => {
  console.log('Connected to MIRAY server');
});

client.on('disconnect', () => {
  console.log('Disconnected from server');
});

client.on('error', (error) => {
  console.error('Client error:', error);
});
```

## Error Handling

```javascript
const client = new MirayClient()
  .onError((error) => {
    console.error('Connection error:', error);
  });

try {
  await client.push('key', 'value');
} catch (error) {
  console.error('Operation failed:', error);
}
```

## Related Packages

- [miray-server](https://www.npmjs.com/package/miray-server) - TCP server
- [miray-cli](https://www.npmjs.com/package/miray-cli) - Interactive CLI

## License

MIT
