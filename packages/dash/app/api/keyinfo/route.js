import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { host, port, username, password, key } = await request.json();

    if (!key) {
      return NextResponse.json(
        { success: false, error: 'Key is required' },
        { status: 400 }
      );
    }

    const { MirayClient } = await import('miray-client');

    const client = new MirayClient({
      host,
      port: parseInt(port, 10),
      username: username || undefined,
      password: password || undefined,
    });

    await client.connect();

    // Get key metadata
    const keyInfo = await client.keyinfo(key);

    await client.disconnect();

    return NextResponse.json({ success: true, data: keyInfo });
  } catch (error) {
    console.error('KeyInfo error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
