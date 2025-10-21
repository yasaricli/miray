import net from 'net';
import { Storage } from './storage.js';
import { Protocol } from './protocol.js';
import { config } from 'miray-common';

/**
 * MIRAY TCP Server
 */
class MirayServer {
  constructor(options = {}) {
    this.host = options.host || config.server.host;
    this.port = options.port || config.server.port;
    this.username = options.username;
    this.password = options.password;
    this.requireAuth = !!(this.username && this.password);
    this.storage = new Storage();
    this.server = null;
    this.connections = new Set();
    this.authenticatedClients = new Set(); // Track authenticated clients

    // Connection stats
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      peakConnections: 0,
      commandsProcessed: 0,
    };

    // Initialize protocol with storage and server reference
    this.protocol = new Protocol(this.storage, this);
  }

  /**
   * Start the server
   */
  async start() {
    // Initialize storage
    await this.storage.init();

    // Create TCP server
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    // Handle server errors
    this.server.on('error', (error) => {
      console.error('[Server] Error:', error);
    });

    // Start listening
    this.server.listen(this.port, this.host, () => {
      console.log(`[Server] MIRAY listening on ${this.host}:${this.port}`);
      if (this.requireAuth) {
        console.log(`[Server] Authentication enabled (username: ${this.username})`);
      } else {
        console.log('[Server] Authentication disabled (no credentials provided)');
      }
    });

    // Handle graceful shutdown
    this.setupShutdownHandlers();
  }

  /**
   * Handle new client connection
   */
  handleConnection(socket) {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;

    // Disable Nagle's algorithm for lower latency
    socket.setNoDelay(true);

    // Enable TCP keep-alive
    socket.setKeepAlive(true, 60000);

    // Update connection stats
    this.stats.totalConnections++;
    this.stats.activeConnections++;
    if (this.stats.activeConnections > this.stats.peakConnections) {
      this.stats.peakConnections = this.stats.activeConnections;
    }

    console.log(`[Server] Client connected: ${clientId} (active: ${this.stats.activeConnections})`);

    this.connections.add(socket);

    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Process complete commands (lines ending with \n)
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (line) {
          this.stats.commandsProcessed++;

          // Check if command is AUTH
          const parts = line.split(' ');
          const command = parts[0].toUpperCase();

          if (command === 'AUTH') {
            const response = this.handleAuth(socket, parts);
            socket.write(response);
            continue;
          }

          // Check authentication for non-AUTH commands
          if (this.requireAuth && !this.authenticatedClients.has(socket)) {
            socket.write('-ERR NOAUTH Authentication required\n');
            continue;
          }

          const response = await this.protocol.execute(line);
          socket.write(response);
        }
      }
    });

    socket.on('end', () => {
      this.stats.activeConnections--;
      console.log(`[Server] Client disconnected: ${clientId} (active: ${this.stats.activeConnections})`);
      this.connections.delete(socket);
      this.authenticatedClients.delete(socket);
    });

    socket.on('error', (error) => {
      this.stats.activeConnections--;
      console.error(`[Server] Socket error for ${clientId}:`, error.message);
      this.connections.delete(socket);
      this.authenticatedClients.delete(socket);
    });
  }

  /**
   * Handle AUTH command
   */
  handleAuth(socket, parts) {
    // If auth not required, return error
    if (!this.requireAuth) {
      return '-ERR AUTH not required\n';
    }

    // Check command format: AUTH username password
    if (parts.length !== 3) {
      return '-ERR AUTH requires username and password\n';
    }

    const [, username, password] = parts;

    // Validate credentials
    if (username === this.username && password === this.password) {
      this.authenticatedClients.add(socket);
      console.log(`[Server] Client authenticated: ${socket.remoteAddress}:${socket.remotePort}`);
      return '+OK Authenticated\n';
    }

    return '-ERR Invalid username or password\n';
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers() {
    const shutdown = async () => {
      console.log('\n[Server] Received shutdown signal');

      // Close server to stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          console.log('[Server] Server closed');
        });
      }

      // Close all active connections
      for (const socket of this.connections) {
        socket.end();
      }

      // Shutdown storage (save data)
      await this.storage.shutdown();

      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  }
}

export { MirayServer };
