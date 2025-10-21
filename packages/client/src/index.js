import net from 'net';
import { EventEmitter } from 'events';
import { config } from 'miray-common';

/**
 * MIRAY Node.js SDK Client
 */
export class MirayClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.host = options.host || 'localhost';
    this.port = options.port || config.server.port;
    this.username = options.username;
    this.password = options.password;
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.commandQueue = [];
    this.buffer = '';
  }

  /**
   * Connect to MIRAY server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(
        { host: this.host, port: this.port },
        async () => {
          // Disable Nagle's algorithm for lower latency
          this.socket.setNoDelay(true);

          // Enable TCP keep-alive
          this.socket.setKeepAlive(true, 60000);

          this.connected = true;
          this.emit('connect');
          console.log(`[Client] Connected to ${this.host}:${this.port}`);

          // Authenticate if credentials provided
          if (this.username && this.password) {
            try {
              await this.authenticate();
              console.log('[Client] Authenticated successfully');
              resolve();
            } catch (error) {
              reject(new Error(`Authentication failed: ${error.message}`));
            }
          } else {
            resolve();
          }
        }
      );

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('end', () => {
        this.connected = false;
        this.emit('disconnect');
        console.log('[Client] Disconnected from server');
      });

      this.socket.on('error', (error) => {
        this.connected = false;
        this.emit('error', error);
        reject(error);
      });
    });
  }

  /**
   * Authenticate with server
   */
  authenticate() {
    return new Promise((resolve, reject) => {
      // Send AUTH command
      this.socket.write(`AUTH ${this.username} ${this.password}\n`);

      // Set up one-time listener for auth response
      const authHandler = (data) => {
        const response = data.toString().trim();

        if (response.startsWith('+OK')) {
          this.authenticated = true;
          this.socket.off('data', authHandler);
          resolve();
        } else if (response.startsWith('-ERR')) {
          this.socket.off('data', authHandler);
          reject(new Error(response.slice(5)));
        }
      };

      // Temporarily use auth handler
      this.socket.on('data', authHandler);
    });
  }

  /**
   * Handle incoming data from server
   */
  handleData(data) {
    this.buffer += data.toString();

    // Try to parse complete responses
    while (this.buffer.length > 0 && this.commandQueue.length > 0) {
      const firstChar = this.buffer[0];

      // For array responses, we need to collect multiple lines
      if (firstChar === '*') {
        const firstNewline = this.buffer.indexOf('\n');
        if (firstNewline === -1) break; // Wait for complete line

        const countLine = this.buffer.slice(0, firstNewline);
        const count = parseInt(countLine.slice(1), 10);

        // We need count+1 lines total (header + count items)
        const lines = this.buffer.split('\n');
        if (lines.length < count + 1) break; // Wait for all lines

        // Extract the complete array response
        const response = lines.slice(0, count + 1).join('\n');
        this.buffer = this.buffer.slice(response.length + 1);

        const { resolve } = this.commandQueue.shift();
        resolve(response);
      } else {
        // Single line response
        const newlineIndex = this.buffer.indexOf('\n');
        if (newlineIndex === -1) break; // Wait for complete line

        const line = this.buffer.slice(0, newlineIndex);
        this.buffer = this.buffer.slice(newlineIndex + 1);

        const { resolve } = this.commandQueue.shift();
        resolve(this.parseResponse(line));
      }
    }
  }

  /**
   * Parse server response
   */
  parseResponse(response) {
    if (!response) return null;

    const firstChar = response[0];

    // Simple string response (+OK, +PONG)
    if (firstChar === '+') {
      return response.slice(1);
    }

    // Error response
    if (firstChar === '-') {
      throw new Error(response.slice(5)); // Remove '-ERR '
    }

    // Integer response
    if (firstChar === ':') {
      return parseInt(response.slice(1), 10);
    }

    // Bulk string response
    if (firstChar === '$') {
      const value = response.slice(1);
      if (value === '-1') return null;
      return value;
    }

    // Array response
    if (firstChar === '*') {
      const count = parseInt(response.slice(1), 10);
      if (count === 0) return [];

      // For array responses, collect all items
      const items = [];
      const lines = response.split('\n');
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          // Extract key from format: 1) "key"
          const match = line.match(/^\d+\)\s+"(.+)"$/);
          if (match) {
            items.push(match[1]);
          }
        }
      }
      return items;
    }

    return response;
  }

  /**
   * Send command to server
   */
  sendCommand(command) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to server'));
      }

      this.commandQueue.push({ resolve, reject });
      this.socket.write(command + '\n');
    });
  }

  /**
   * PING command
   */
  async ping() {
    const response = await this.sendCommand('PING');
    return response === 'PONG';
  }

  /**
   * PUSH command - Set a key-value pair with optional TTL
   */
  async push(key, value, ttl = null) {
    // Serialize value if it's an object
    const serializedValue =
      typeof value === 'object' ? JSON.stringify(value) : value;

    let command = `PUSH ${key} "${serializedValue}"`;
    if (ttl) {
      command += ` ${ttl}`;
    }

    const response = await this.sendCommand(command);
    return response === 'OK';
  }

  /**
   * GET command - Get a value by key
   */
  async get(key, parse = true) {
    const command = `GET ${key}`;
    const response = await this.sendCommand(command);

    if (response === null) {
      return null;
    }

    // Try to parse JSON if parse is true
    if (parse) {
      try {
        return JSON.parse(response);
      } catch {
        return response;
      }
    }

    return response;
  }

  /**
   * REMOVE command - Delete a key
   */
  async remove(key) {
    const command = `REMOVE ${key}`;
    const response = await this.sendCommand(command);
    return response === 1;
  }

  /**
   * KEYS command - Get all keys matching pattern
   */
  async keys(pattern = '*') {
    const command = `KEYS ${pattern}`;

    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to server'));
      }

      this.socket.write(command + '\n');

      // Special handling for array responses
      const originalBuffer = this.buffer;
      let fullResponse = '';

      const dataHandler = (data) => {
        fullResponse += data.toString();

        // Check if we have complete response (ends with newline after last item)
        const lines = fullResponse.split('\n');
        if (lines[0].startsWith('*')) {
          const count = parseInt(lines[0].slice(1), 10);

          if (count === 0) {
            this.socket.off('data', dataHandler);
            this.buffer = fullResponse.slice(lines[0].length + 1);
            return resolve([]);
          }

          // Check if we have all items (count + 1 for the header line + 1 for empty line)
          if (lines.length >= count + 1) {
            this.socket.off('data', dataHandler);

            const items = [];
            for (let i = 1; i <= count; i++) {
              const line = lines[i].trim();
              if (line) {
                const match = line.match(/^\d+\)\s+"(.+)"$/);
                if (match) {
                  items.push(match[1]);
                }
              }
            }

            // Update buffer
            this.buffer = lines.slice(count + 1).join('\n');

            return resolve(items);
          }
        }
      };

      this.socket.on('data', dataHandler);

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socket.off('data', dataHandler);
        reject(new Error('Command timeout'));
      }, 5000);
    });
  }

  /**
   * TTL command - Get remaining TTL in seconds
   */
  async ttl(key) {
    const command = `TTL ${key}`;
    return await this.sendCommand(command);
  }

  /**
   * FLUSH command - Clear all data
   */
  async flush() {
    const command = `FLUSH`;
    const response = await this.sendCommand(command);
    return response === 'OK';
  }

  /**
   * INFO command - Get server information
   */
  async info() {
    const command = `INFO`;
    return await this.sendCommand(command);
  }

  /**
   * MGET - Get multiple values at once (batch operation)
   * @param {string[]} keys - Array of keys to retrieve
   * @returns {Promise<Array>} - Array of values (null for missing keys)
   */
  async mget(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error('keys must be a non-empty array');
    }

    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('Not connected to server'));
      }

      const command = `MGET ${keys.join(' ')}`;

      this.commandQueue.push({
        resolve: (rawResponse) => {
          // Parse array response manually
          if (typeof rawResponse === 'string' && rawResponse.startsWith('*')) {
            const lines = rawResponse.split('\n').filter((l) => l.trim());
            const count = parseInt(lines[0].slice(1), 10);
            const values = [];

            for (let i = 1; i <= count; i++) {
              const line = lines[i];
              if (line === '$-1') {
                values.push(null);
              } else if (line.startsWith('$')) {
                values.push(line.slice(1));
              }
            }

            resolve(values);
          } else {
            resolve(rawResponse);
          }
        },
        reject,
      });

      this.socket.write(command + '\n');
    });
  }

  /**
   * MSET - Set multiple key-value pairs at once (batch operation)
   * @param {Object} pairs - Object with key-value pairs, or array of [key, value, ttl?]
   * @returns {Promise<string>} - OK on success
   */
  async mset(pairs) {
    let command = 'MSET';

    if (Array.isArray(pairs)) {
      // Format: [[key1, value1, ttl1], [key2, value2], ...]
      for (const item of pairs) {
        const [key, value, ttl] = item;
        command += ` ${key} ${value}`;
        if (ttl) command += ` ${ttl}`;
      }
    } else if (typeof pairs === 'object') {
      // Format: { key1: value1, key2: value2, ... }
      for (const [key, value] of Object.entries(pairs)) {
        command += ` ${key} ${value}`;
      }
    } else {
      throw new Error('pairs must be an object or array');
    }

    return await this.sendCommand(command);
  }

  /**
   * MDEL - Delete multiple keys at once (batch operation)
   * @param {string[]} keys - Array of keys to delete
   * @returns {Promise<number>} - Number of keys deleted
   */
  async mdel(keys) {
    if (!Array.isArray(keys) || keys.length === 0) {
      throw new Error('keys must be a non-empty array');
    }

    const command = `MDEL ${keys.join(' ')}`;
    return await this.sendCommand(command);
  }

  /**
   * Pipeline - Execute multiple commands in sequence efficiently
   * @param {Function} callback - Function that receives a pipeline object
   * @returns {Promise<Array>} - Array of results
   */
  async pipeline(callback) {
    const commands = [];
    const pipeline = {
      get: (key) => commands.push(`GET ${key}`),
      set: (key, value, ttl) =>
        commands.push(`PUSH ${key} ${value}${ttl ? ' ' + ttl : ''}`),
      del: (key) => commands.push(`REMOVE ${key}`),
      mget: (keys) => commands.push(`MGET ${keys.join(' ')}`),
      mset: (pairs) => {
        let cmd = 'MSET';
        if (Array.isArray(pairs)) {
          for (const [key, value, ttl] of pairs) {
            cmd += ` ${key} ${value}`;
            if (ttl) cmd += ` ${ttl}`;
          }
        } else {
          for (const [key, value] of Object.entries(pairs)) {
            cmd += ` ${key} ${value}`;
          }
        }
        commands.push(cmd);
      },
      mdel: (keys) => commands.push(`MDEL ${keys.join(' ')}`),
    };

    // Execute callback to build pipeline
    callback(pipeline);

    // Execute all commands
    const results = [];
    for (const cmd of commands) {
      results.push(await this.sendCommand(cmd));
    }

    return results;
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.end();
      this.socket = null;
      this.connected = false;
    }
  }
}

export default MirayClient;
