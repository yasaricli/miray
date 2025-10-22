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

    // Get server info
    const infoResponse = await client.info();

    await client.disconnect();

    // Parse INFO response
    const stats = parseInfo(infoResponse);

    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

function parseInfo(infoString) {
  const stats = {};
  const lines = infoString.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const [key, value] = trimmed.split(':').map((s) => s.trim());
    if (key && value !== undefined) {
      // Convert snake_case to camelCase
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

      // Keep version as string (e.g., "2.0.4")
      if (camelKey === 'version') {
        stats[camelKey] = value;
        continue;
      }

      // Try to parse as number (remove units like 'bytes' or 's')
      const cleanValue = value.replace(/[^0-9.-]/g, '');
      const numValue = parseFloat(cleanValue);
      stats[camelKey] = isNaN(numValue) ? value : numValue;
    }
  }

  return stats;
}
