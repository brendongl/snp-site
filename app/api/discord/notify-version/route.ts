/**
 * Discord Version Notification Endpoint
 * POST /api/discord/notify-version
 *
 * Sends a Discord webhook notification with version release details
 * Used in CI/CD pipelines when pushing new versions to main branch
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendDiscordNotification, createVersionReleaseEmbed } from '@/lib/discord/webhook';

interface NotificationRequest {
  version: string;
  buildDate: string;
  changes?: string[];
  webhookUrl?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify the request is from a trusted source (basic auth or token)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.DISCORD_WEBHOOK_TOKEN || 'dev-token';

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: NotificationRequest = await request.json();
    const {
      version,
      buildDate,
      changes = [],
      webhookUrl: customWebhookUrl,
    } = body;

    // Validate required fields
    if (!version || !buildDate) {
      return NextResponse.json(
        { error: 'Missing required fields: version, buildDate' },
        { status: 400 }
      );
    }

    // Get webhook URL from request or environment
    const webhookUrl = customWebhookUrl || process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'No webhook URL configured' },
        { status: 500 }
      );
    }

    // Create and send the embed message
    const message = createVersionReleaseEmbed(version, buildDate, changes);
    const result = await sendDiscordNotification(webhookUrl, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send Discord notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Notification sent for v${version}`,
    });
  } catch (error) {
    console.error('Discord notification error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
