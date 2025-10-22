import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { host, port, username, password } = await request.json();

    const { MirayClient } = await import('miray-client');

    const client = new MirayClient({
      host,
      port: parseInt(port, 10),
      username: username || undefined,
      password: password || undefined,
    });

    await client.connect();

    // Get all keys (already returns parsed array)
    const keys = await client.keys('*');

    await client.disconnect();

    return NextResponse.json({ success: true, data: keys });
  } catch (error) {
    console.error('Keys error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
