/**
 * Protocol handler for MIRAY commands
 * Text-based protocol where each command is newline-separated
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json
let version = '0.0.0';
try {
  const packageJson = JSON.parse(
    readFileSync(join(__dirname, '../package.json'), 'utf-8')
  );
  version = packageJson.version;
} catch (error) {
  console.warn('[Protocol] Could not read version from package.json');
}

export class Protocol {
  constructor(storage, server = null) {
    this.storage = storage;
    this.server = server;
    this.version = version;
  }

  /**
   * Parse and execute a command
   * @param {string} commandLine - Raw command string
   * @returns {Promise<string>} - Response string
   */
  async execute(commandLine) {
    try {
      const parts = this.parseCommand(commandLine);
      if (parts.length === 0) {
        return '-ERR empty command\n';
      }

      const command = parts[0].toUpperCase();

      switch (command) {
        case 'PING':
          return this.handlePing();

        case 'PUSH':
          return await this.handlePush(parts);

        case 'GET':
          return this.handleGet(parts);

        case 'REMOVE':
          return await this.handleRemove(parts);

        case 'KEYS':
          return this.handleKeys(parts);

        case 'TTL':
          return this.handleTTL(parts);

        case 'FLUSH':
          return await this.handleFlush();

        case 'INFO':
          return this.handleInfo();

        // Batch operations for performance
        case 'MGET':
          return this.handleMGet(parts);

        case 'MPUSH':
          return await this.handleMPush(parts);

        case 'MREMOVE':
          return await this.handleMRemove(parts);

        case 'HELP':
          return this.handleHelp();

        case 'KEYINFO':
          return this.handleKeyInfo(parts);

        default:
          return `-ERR unknown command '${command}'\n`;
      }
    } catch (error) {
      return `-ERR ${error.message}\n`;
    }
  }

  /**
   * Parse command line into parts, respecting quoted strings
   */
  parseCommand(commandLine) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < commandLine.length; i++) {
      const char = commandLine[i];

      if ((char === '"' || char === "'") && !inQuotes) {
        inQuotes = true;
        quoteChar = char;
      } else if (char === quoteChar && inQuotes) {
        inQuotes = false;
        quoteChar = null;
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          parts.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current) {
      parts.push(current);
    }

    return parts;
  }

  /**
   * Parse TTL string (30s, 5m, 2h, 1d) to milliseconds
   */
  parseTTL(ttlString) {
    if (!ttlString) return null;

    const match = ttlString.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`invalid TTL format: ${ttlString}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1000,           // seconds
      m: 60 * 1000,      // minutes
      h: 60 * 60 * 1000, // hours
      d: 24 * 60 * 60 * 1000, // days
    };

    return value * multipliers[unit];
  }

  handlePing() {
    return '+PONG\n';
  }

  async handlePush(parts) {
    if (parts.length < 3) {
      return '-ERR wrong number of arguments for PUSH\n';
    }

    const key = parts[1];
    const value = parts[2];
    const ttl = parts[3] ? this.parseTTL(parts[3]) : null;

    await this.storage.set(key, value, ttl);
    return '+OK\n';
  }

  handleGet(parts) {
    if (parts.length < 2) {
      return '-ERR wrong number of arguments for GET\n';
    }

    const key = parts[1];
    const value = this.storage.get(key);

    if (value === null) {
      return '$-1\n'; // null bulk string
    }

    return `$${value}\n`;
  }

  async handleRemove(parts) {
    if (parts.length < 2) {
      return '-ERR wrong number of arguments for REMOVE\n';
    }

    const key = parts[1];
    const deleted = await this.storage.delete(key);

    return deleted ? ':1\n' : ':0\n';
  }

  handleKeys(parts) {
    const pattern = parts.length > 1 ? parts[1] : '*';
    const keys = this.storage.keys(pattern);

    if (keys.length === 0) {
      return '*0\n';
    }

    let response = `*${keys.length}\n`;
    keys.forEach((key, index) => {
      response += `${index + 1}) "${key}"\n`;
    });

    return response;
  }

  handleTTL(parts) {
    if (parts.length < 2) {
      return '-ERR wrong number of arguments for TTL\n';
    }

    const key = parts[1];
    const ttl = this.storage.getTTL(key);

    if (ttl === null) {
      return ':-2\n'; // key doesn't exist
    }

    if (ttl === -1) {
      return ':-1\n'; // key exists but has no expiration
    }

    return `:${ttl}\n`;
  }

  async handleFlush() {
    await this.storage.flush();
    return '+OK\n';
  }

  handleInfo() {
    const info = this.storage.getInfo();
    let response = '+';
    response += `MIRAY Server v${this.version}\n`;
    response += `\n# Storage\n`;
    response += `keys: ${info.keys}\n`;
    response += `memory: ~${info.memory} bytes\n`;
    response += `reads: ${info.reads}\n`;
    response += `writes: ${info.writes}\n`;
    response += `deletes: ${info.deletes}\n`;
    response += `ops_total: ${info.opsTotal}\n`;
    response += `ops_since_checkpoint: ${info.opsSinceCheckpoint}\n`;
    if (info.lastCheckpoint) {
      response += `last_checkpoint: ${info.lastCheckpoint}\n`;
    }

    // Server stats
    if (this.server) {
      response += `\n# Server\n`;
      response += `version: ${this.version}\n`;
      response += `uptime: ${info.uptime}s\n`;
      response += `active_connections: ${this.server.stats.activeConnections}\n`;
      response += `total_connections: ${this.server.stats.totalConnections}\n`;
      response += `peak_connections: ${this.server.stats.peakConnections}\n`;
      response += `commands_processed: ${this.server.stats.commandsProcessed}\n`;
    }

    return response;
  }

  /**
   * MGET - Get multiple values at once
   * Usage: MGET key1 key2 key3 ...
   * Returns array of values
   */
  handleMGet(parts) {
    if (parts.length < 2) {
      return '-ERR wrong number of arguments for MGET\n';
    }

    const keys = parts.slice(1);
    const values = keys.map((key) => this.storage.get(key));

    // Return as array
    let response = `*${values.length}\n`;
    for (const value of values) {
      if (value === null) {
        response += '$-1\n';
      } else {
        response += `$${value}\n`;
      }
    }

    return response;
  }

  /**
   * MPUSH - Set multiple key-value pairs at once
   * Usage: MPUSH key1 value1 [ttl1] key2 value2 [ttl2] ...
   * Returns OK
   */
  async handleMPush(parts) {
    if (parts.length < 3) {
      return '-ERR wrong number of arguments for MPUSH\n';
    }

    const args = parts.slice(1);
    let i = 0;

    while (i < args.length) {
      const key = args[i];
      const value = args[i + 1];

      if (!key || value === undefined) {
        return '-ERR wrong number of arguments for MPUSH\n';
      }

      // Check if next arg is TTL (starts with number and ends with time unit)
      let ttl = null;
      if (args[i + 2] && /^\d+[smh]$/.test(args[i + 2])) {
        ttl = this.parseTTL(args[i + 2]);
        i += 3;
      } else {
        i += 2;
      }

      await this.storage.set(key, value, ttl);
    }

    return '+OK\n';
  }

  /**
   * MREMOVE - Delete multiple keys at once
   * Usage: MREMOVE key1 key2 key3 ...
   * Returns number of keys deleted
   */
  async handleMRemove(parts) {
    if (parts.length < 2) {
      return '-ERR wrong number of arguments for MREMOVE\n';
    }

    const keys = parts.slice(1);
    let deletedCount = 0;

    for (const key of keys) {
      const deleted = await this.storage.delete(key);
      if (deleted) deletedCount++;
    }

    return `:${deletedCount}\n`;
  }

  /**
   * HELP - Show available commands
   */
  handleHelp() {
    const commands = {
      'Basic Commands': [
        { cmd: 'PING', desc: 'Test server connection' },
        { cmd: 'HELP', desc: 'Show this help message' },
        { cmd: 'INFO', desc: 'Get server information and statistics' },
      ],
      'Data Operations': [
        { cmd: 'PUSH key value [ttl]', desc: 'Store a value with optional TTL (e.g., 30s, 5m, 2h, 1d)' },
        { cmd: 'GET key', desc: 'Retrieve a value by key' },
        { cmd: 'REMOVE key', desc: 'Delete a key' },
        { cmd: 'KEYS [pattern]', desc: 'List all keys matching pattern (default: *)' },
        { cmd: 'TTL key', desc: 'Get time-to-live for a key in milliseconds' },
        { cmd: 'KEYINFO key', desc: 'Get key metadata (reads, writes, TTL, timestamps)' },
        { cmd: 'FLUSH', desc: 'Delete all keys' },
      ],
      'Batch Operations': [
        { cmd: 'MGET key1 key2 ...', desc: 'Get multiple values at once' },
        { cmd: 'MPUSH key1 val1 [ttl1] ...', desc: 'Set multiple key-value pairs at once' },
        { cmd: 'MREMOVE key1 key2 ...', desc: 'Delete multiple keys at once' },
      ],
      'CLI Commands': [
        { cmd: 'exit, quit', desc: 'Disconnect from server' },
      ],
    };

    const sections = Object.entries(commands).map(([title, cmds]) => {
      const commandList = cmds
        .map(({ cmd, desc }) => `  ${cmd.padEnd(30)} - ${desc}`)
        .join('\n');
      return `${title}:\n${commandList}`;
    }).join('\n\n');

    return `+MIRAY Commands:\n\n${sections}\n`;
  }

  /**
   * KEYINFO - Get metadata about a specific key
   * Returns: reads, writes, TTL, created, last accessed
   */
  handleKeyInfo(parts) {
    if (parts.length < 2) {
      return '-ERR wrong number of arguments for KEYINFO\n';
    }

    const key = parts[1];
    const entry = this.storage.store.get(key);

    if (!entry) {
      return '$-1\n'; // Key not found
    }

    // Check if expired
    if (entry.expiresAt && Date.now() >= entry.expiresAt) {
      return '$-1\n';
    }

    // Calculate TTL
    let ttl = -1;
    if (entry.expiresAt) {
      ttl = Math.floor((entry.expiresAt - Date.now()) / 1000);
      if (ttl < 0) ttl = -2; // expired
    }

    // Build response with key metadata
    const info = {
      key,
      reads: entry.reads || 0,
      writes: entry.writes || 0,
      ttl,
      createdAt: entry.createdAt || null,
      lastAccessAt: entry.lastAccessAt || null,
    };

    return `+${JSON.stringify(info)}\n`;
  }
}
