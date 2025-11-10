import { NextRequest } from 'next/server';
import { SwitchNotifier } from '@/lib/services/switch-notifier';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the notifier
      const notifier = SwitchNotifier.getInstance();
      notifier.addConnection(controller);

      console.log(`[SSE] New client connected. Total: ${notifier.getConnectionCount()}`);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        notifier.removeConnection(controller);
        controller.close();
        console.log(`[SSE] Client disconnected. Remaining: ${notifier.getConnectionCount()}`);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}