import net from 'net';
import { Storage } from './storage.js';
import { Protocol } from './protocol.js';
import { config } from '../config.js';

/**
 * MIRAY TCP Server
 */
class MirayServer {
  constructor(options = {}) {
    this.host = options.host || config.server.host;
    this.port = options.port || config.server.port;
    this.storage = new Storage();
    this.server = null;
    this.connections = new Set();

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
    });

    // Handle graceful shutdown
    this.setupShutdownHandlers();
  }

  /**
   * Handle new client connection
   */
  handleConnection(socket) {
    const clientId = `${socket.remoteAddress}:${socket.remotePort}`;

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
          const response = await this.protocol.execute(line);
          socket.write(response);
        }
      }
    });

    socket.on('end', () => {
      this.stats.activeConnections--;
      console.log(`[Server] Client disconnected: ${clientId} (active: ${this.stats.activeConnections})`);
      this.connections.delete(socket);
    });

    socket.on('error', (error) => {
      this.stats.activeConnections--;
      console.error(`[Server] Socket error for ${clientId}:`, error.message);
      this.connections.delete(socket);
    });
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

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' || args[i] === '-p') {
      options.port = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--host' || args[i] === '-h') {
      options.host = args[i + 1];
      i++;
    }
  }

  return options;
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs();
  const server = new MirayServer(options);
  server.start().catch((error) => {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  });
}

export { MirayServer };
