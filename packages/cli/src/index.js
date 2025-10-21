import readline from 'readline';
import net from 'net';
import { config } from 'miray-common';

/**
 * MIRAY Interactive CLI
 */
class MirayCLI {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || config.server.port;
    this.username = options.username;
    this.password = options.password;
    this.socket = null;
    this.rl = null;
    this.buffer = '';
    this.waitingForResponse = false;
    this.authenticated = false;
  }

  /**
   * Start the CLI
   */
  async start() {
    console.log('MIRAY CLI - Memory In-memory Real-time Async Yield');
    console.log(`Connecting to ${this.host}:${this.port}...`);

    try {
      await this.connect();

      // Authenticate if credentials provided
      if (this.username && this.password) {
        const authSuccess = await this.authenticate();
        if (!authSuccess) {
          console.error('Authentication failed');
          process.exit(1);
        }
      }

      console.log('Type "HELP" to see available commands\n');
      this.startREPL();
    } catch (error) {
      console.error(`Failed to connect: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Connect to MIRAY server
   */
  connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(
        { host: this.host, port: this.port },
        () => {
          console.log('Connected!\n');
          resolve();
        }
      );

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('end', () => {
        console.log('\nDisconnected from server');
        process.exit(0);
      });

      this.socket.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Authenticate with server
   */
  authenticate() {
    return new Promise((resolve) => {
      console.log(`Authenticating as ${this.username}...`);

      // Set up one-time listener for auth response
      const authHandler = (data) => {
        const response = data.toString().trim();

        if (response.startsWith('+OK')) {
          console.log('Authenticated!\n');
          this.authenticated = true;
          this.socket.off('data', authHandler);
          resolve(true);
        } else if (response.startsWith('-ERR')) {
          console.error(`Authentication error: ${response.slice(5)}`);
          this.socket.off('data', authHandler);
          resolve(false);
        }
      };

      // Temporarily use auth handler
      this.socket.on('data', authHandler);

      // Send AUTH command
      this.socket.write(`AUTH ${this.username} ${this.password}\n`);
    });
  }

  /**
   * Handle incoming data from server
   */
  handleData(data) {
    this.buffer += data.toString();

    // For array responses, we need to collect the entire response
    if (this.buffer.startsWith('*')) {
      const lines = this.buffer.split('\n');
      const firstLine = lines[0];

      if (firstLine.startsWith('*')) {
        const count = parseInt(firstLine.slice(1), 10);

        // If count is 0, we have the complete response
        if (count === 0) {
          this.displayResponse(this.buffer.trim());
          this.buffer = '';
          this.waitingForResponse = false;
          this.prompt();
          return;
        }

        // Check if we have all items (need count lines + header line)
        if (lines.length >= count + 1) {
          // Find the last non-empty line
          let lastItemIndex = count;
          while (lastItemIndex > 0 && !lines[lastItemIndex].trim()) {
            lastItemIndex--;
          }

          if (lastItemIndex >= count || lines[count]) {
            const response = lines.slice(0, count + 1).join('\n');
            this.displayResponse(response);
            this.buffer = '';
            this.waitingForResponse = false;
            this.prompt();
            return;
          }
        }
      }
      return; // Wait for more data
    }

    // Process single-line responses
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line) {
        this.displayResponse(line);
        this.waitingForResponse = false;
        this.prompt();
      }
    }
  }

  /**
   * Display server response
   */
  displayResponse(response) {
    if (!response) return;

    const firstChar = response[0];

    // Simple string response (+OK, +PONG)
    if (firstChar === '+') {
      console.log(response.slice(1));
      return;
    }

    // Error response
    if (firstChar === '-') {
      console.log(response); // Print the full error
      return;
    }

    // Integer response
    if (firstChar === ':') {
      console.log(response.slice(1));
      return;
    }

    // Bulk string response
    if (firstChar === '$') {
      const value = response.slice(1);
      if (value === '-1') {
        console.log('(nil)');
      } else {
        console.log(value);
      }
      return;
    }

    // Array response
    if (firstChar === '*') {
      const lines = response.split('\n');
      const count = parseInt(lines[0].slice(1), 10);

      if (count === 0) {
        console.log('(empty array)');
        return;
      }

      for (let i = 1; i <= count && i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          console.log(line);
        }
      }
      return;
    }

    console.log(response);
  }

  /**
   * Start REPL (Read-Eval-Print Loop)
   */
  startREPL() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> ',
    });

    this.rl.on('line', (line) => {
      const trimmed = line.trim();

      if (!trimmed) {
        this.prompt();
        return;
      }

      // Handle exit commands
      if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
        this.socket.end();
        process.exit(0);
        return;
      }

      // Handle help command (can be case-insensitive)
      if (trimmed.toLowerCase() === 'help') {
        this.waitingForResponse = true;
        this.socket.write('HELP\n');
        return;
      }

      // Send command to server
      this.waitingForResponse = true;
      this.socket.write(trimmed + '\n');
    });

    this.rl.on('close', () => {
      console.log('\nGoodbye!');
      this.socket.end();
      process.exit(0);
    });

    // Show initial prompt
    this.prompt();
  }

  /**
   * Show prompt
   */
  prompt() {
    if (this.rl && !this.waitingForResponse) {
      this.rl.prompt();
    }
  }
}

export { MirayCLI };
