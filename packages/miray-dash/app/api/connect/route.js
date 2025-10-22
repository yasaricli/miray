import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { host, port, username, password } = await request.json();

    // Dynamically import miray-client (Node.js module)
    const { MirayClient } = await import('miray-client');

    const client = new MirayClient({
      host,
      port: parseInt(port, 10),
      username: username || undefined,
      password: password || undefined,
    });

    // Test connection
    await client.connect();

    // Try PING command to verify connection
    await client.ping();

    // If we got here, connection is successful
    // Disconnect
    await client.disconnect();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Connection error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to connect to MIRAY server',
      },
      { status: 500 }
    );
  }
}
