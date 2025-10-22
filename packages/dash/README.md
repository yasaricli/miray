# MIRAY Dashboard

Web-based management dashboard for MIRAY in-memory key-value store.

## Features

- 🔌 **Easy Connection**: Connect to any MIRAY server with host/port
- 🔐 **Authentication Support**: Optional username/password
- 📊 **Statistics Dashboard**: Real-time server metrics
- 🔑 **Key Management**: View, search, and delete keys
- 📈 **Performance Monitoring**: Track reads, writes, and operations
- 💾 **Memory Usage**: Monitor storage and key counts
- 🎨 **Modern UI**: Built with Next.js, Bootstrap, and SASS

## Installation

```bash
cd packages/dash
npm install
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Connect to Server**
   - Enter MIRAY server host (default: localhost)
   - Enter port (default: 7779)
   - Optional: Add username/password if authentication is enabled
   - Click "Connect"

2. **Dashboard**
   - View real-time server statistics
   - Monitor keys, memory, and operations
   - Track performance metrics

3. **Key Management** *(Coming soon)*
   - Browse all keys
   - View key details and TTL
   - Delete keys
   - Search and filter

## Build for Production

```bash
npm run build
npm start
```

## Environment Variables

Create `.env.local` file:

```env
# Optional: Default MIRAY server
NEXT_PUBLIC_DEFAULT_HOST=localhost
NEXT_PUBLIC_DEFAULT_PORT=7779
```

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **UI**: Bootstrap 5.3
- **Styling**: SASS
- **Client**: miray-client
- **Language**: JavaScript (ES6+)

## License

MIT
