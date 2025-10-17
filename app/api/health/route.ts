import { NextResponse } from 'next/server';

export async function GET() {
  // Test DNS resolution
  let dnsTest = { success: false, error: null as string | null };
  try {
    const dns = await import('dns').then(m => m.promises);
    await dns.resolve('api.airtable.com');
    dnsTest.success = true;
  } catch (error) {
    dnsTest.error = error instanceof Error ? error.message : 'DNS resolution failed';
  }

  const envCheck = {
    timestamp: new Date().toISOString(),
    environment: {
      AIRTABLE_API_KEY: !!process.env.AIRTABLE_API_KEY,
      AIRTABLE_GAMES_BASE_ID: !!process.env.AIRTABLE_GAMES_BASE_ID,
      AIRTABLE_GAMES_TABLE_ID: !!process.env.AIRTABLE_GAMES_TABLE_ID,
      AIRTABLE_GAMES_VIEW_ID: !!process.env.AIRTABLE_GAMES_VIEW_ID,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    },
    envDetails: {
      API_KEY_LENGTH: process.env.AIRTABLE_API_KEY?.length || 0,
      BASE_ID: process.env.AIRTABLE_GAMES_BASE_ID || 'NOT SET',
      TABLE_ID: process.env.AIRTABLE_GAMES_TABLE_ID || 'NOT SET',
      VIEW_ID: process.env.AIRTABLE_GAMES_VIEW_ID || 'NOT SET',
    },
    nodeEnv: process.env.NODE_ENV,
    dnsTest,
  };

  // Try to connect to Airtable
  let airtableTest = {
    success: false,
    error: null as string | null,
    details: null as any,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_GAMES_BASE_ID}/${process.env.AIRTABLE_GAMES_TABLE_ID}?maxRecords=1`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (response.ok) {
      airtableTest.success = true;
    } else {
      airtableTest.error = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (error) {
    airtableTest.error = error instanceof Error ? error.message : 'Unknown error';
    airtableTest.details = {
      name: error instanceof Error ? error.name : 'Unknown',
      cause: error instanceof Error ? (error as any).cause : null,
      code: (error as any).code,
      errno: (error as any).errno,
      syscall: (error as any).syscall,
    };
  }

  return NextResponse.json({
    status: airtableTest.success ? 'healthy' : 'unhealthy',
    envCheck,
    airtableTest,
  }, {
    status: airtableTest.success ? 200 : 500
  });
}
