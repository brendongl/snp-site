import { NextRequest, NextResponse } from 'next/server';
import { SwitchNotifier } from '@/lib/services/switch-notifier';
import videoGamesDbService from '@/lib/services/video-games-db-service';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    console.log('[Switch Webhook] Received:', JSON.stringify(data, null, 2));

    // Extract game info from the webhook
    const {
      action,
      title_name,
      title_id,
      serial,
      controller_count
    } = data;

    // Try to find the game image in our database
    let gameImage = null;
    try {
      const games = await videoGamesDbService.getAllGames();

      // Try to match by title name (case insensitive)
      const game = games.find(g =>
        g.name?.toLowerCase() === title_name?.toLowerCase() ||
        g.name?.toLowerCase().includes(title_name?.toLowerCase()) ||
        title_name?.toLowerCase().includes(g.name?.toLowerCase())
      );

      if (game && game.image_screenshot_url) {
        gameImage = game.image_screenshot_url;
      }
    } catch (error) {
      console.error('[Switch Webhook] Error fetching game image:', error);
    }

    // Prepare notification data
    const notification = {
      type: 'switch_game',
      action: action === 'Launch' ? 'started' : 'finished',
      game: {
        name: title_name,
        titleId: title_id,
        image: gameImage
      },
      player: {
        serial: serial?.substring(0, 3) + '***', // Partially hide serial for privacy
        controllerCount: controller_count
      },
      timestamp: new Date().toISOString()
    };

    // Broadcast to all connected clients
    const notifier = SwitchNotifier.getInstance();
    notifier.broadcast(notification);

    // Log the event
    console.log(`[Switch Webhook] ${action === 'Launch' ? '🎮 Started' : '🛑 Finished'} playing: ${title_name}`);
    console.log(`[Switch Webhook] Broadcasting to ${notifier.getConnectionCount()} clients`);

    return NextResponse.json({
      status: 'success',
      message: 'Notification sent',
      clients: notifier.getConnectionCount()
    });
  } catch (error) {
    console.error('[Switch Webhook] Error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

// Also support GET for testing
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    message: 'Switch webhook endpoint is ready',
    endpoint: '/api/switch-webhook',
    method: 'POST',
    expectedPayload: {
      serial: 'string',
      hos_version: 'string',
      ams_version: 'string',
      action: 'Launch | Exit',
      title_id: 'string',
      title_version: 'string',
      title_name: 'string',
      controller_count: 'number'
    }
  });
}