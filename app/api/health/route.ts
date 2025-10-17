import { NextResponse } from 'next/server';

export async function GET() {
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
  };

  // Try to connect to Airtable
  let airtableTest = {
    success: false,
    error: null as string | null,
  };

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_GAMES_BASE_ID}/${process.env.AIRTABLE_GAMES_TABLE_ID}?maxRecords=1`,
      {
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        },
      }
    );

    if (response.ok) {
      airtableTest.success = true;
    } else {
      airtableTest.error = `HTTP ${response.status}: ${response.statusText}`;
    }
  } catch (error) {
    airtableTest.error = error instanceof Error ? error.message : 'Unknown error';
  }

  return NextResponse.json({
    status: airtableTest.success ? 'healthy' : 'unhealthy',
    envCheck,
    airtableTest,
  }, {
    status: airtableTest.success ? 200 : 500
  });
}
