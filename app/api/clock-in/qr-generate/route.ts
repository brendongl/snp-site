/**
 * QR Code Generation API
 * POST /api/clock-in/qr-generate - Generate QR code for clock-in location
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location_name, location_id } = body;

    if (!location_name || !location_id) {
      return NextResponse.json(
        { error: 'location_name and location_id are required' },
        { status: 400 }
      );
    }

    // Generate unique token for this location
    const token = Buffer.from(JSON.stringify({
      location_id,
      location_name,
      generated_at: new Date().toISOString(),
      version: '1.0'
    })).toString('base64');

    // Generate QR code URL
    const baseUrl = process.env.NEXTAUTH_URL || 'https://sipnplay.cafe';
    const qrData = `${baseUrl}/clock-in?token=${token}`;

    return NextResponse.json({
      success: true,
      qr_data: qrData,
      token,
      location_name,
      location_id,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error generating QR code:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate QR code',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Return pre-configured locations
    const locations = [
      { id: 'main-entrance', name: 'Main Entrance' },
      { id: 'back-office', name: 'Back Office' },
      { id: 'storage-room', name: 'Storage Room' },
    ];

    return NextResponse.json({
      success: true,
      locations,
    });

  } catch (error) {
    console.error('Error fetching locations:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch locations',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
