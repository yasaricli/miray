import net from 'net';
import { EventEmitter } from 'events';
import { config } from '../config.js';

/**
 * MIRAY Node.js SDK Client
 */
export class MirayClient extends EventEmitter {
  constructor(options = {}) {
    super();
    this.host = options.host || 'localhost';
    this.port = options.port || config.server.port;
    this.socket = null;
    this.connected = false;
    this.commandQueue = [];
    this.buffer = '';
  }

  /**
   * Connect to MIRAY server
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(
        { host: this.host, port: this.port },
        () => {
          this.connected = true;
          this.emit('connect');
          console.log(`[Client] Connected to ${this.host}:${this.port}`);
          resolve();
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
   * Handle incoming data from server
   */
  handleData(data) {
    this.buffer += data.toString();

    // Process complete responses
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (this.commandQueue.length > 0) {
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
