'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download, Copy, CheckCircle2 } from 'lucide-react';

interface WebhookPayload {
  id: string;
  timestamp: string;
  action: 'started' | 'finished';
  game: {
    name: string;
    titleId: string;
    image?: string;
  };
  player: {
    serial: string;
    controllerCount: number;
  };
  raw?: any;
}

export default function SwitchWebhookMonitor() {
  const [webhooks, setWebhooks] = useState<WebhookPayload[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Connect to SSE endpoint
    const connectSSE = () => {
      console.log('[Monitor] Connecting to SSE...');

      const eventSource = new EventSource('/api/switch-notifications');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[Monitor] SSE Connected');
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('[Monitor] Received webhook:', data);

          // Ignore connection messages
          if (data.type === 'connected') {
            console.log('[Monitor]', data.message);
            return;
          }

          // Only process actual game webhooks
          if (data.type === 'switch_game' && data.game && data.game.name) {
            // Add unique ID and store raw data
            const webhook: WebhookPayload = {
              ...data,
              id: `${Date.now()}-${Math.random()}`,
              raw: data
            };

            setWebhooks(prev => [webhook, ...prev].slice(0, 100)); // Keep last 100

            // Auto-scroll to top if enabled
            if (autoScroll && scrollRef.current) {
              scrollRef.current.scrollTop = 0;
            }
          }
        } catch (error) {
          console.error('[Monitor] Error parsing SSE data:', error);
        }
      };

      eventSource.onerror = () => {
        console.log('[Monitor] SSE Connection lost, reconnecting...');
        setIsConnected(false);
        eventSource.close();

        // Reconnect after 2 seconds
        setTimeout(connectSSE, 2000);
      };
    };

    connectSSE();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [autoScroll]);

  const clearWebhooks = () => {
    setWebhooks([]);
  };

  const copyPayload = (webhook: WebhookPayload) => {
    const json = JSON.stringify(webhook.raw, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(webhook.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadPayloads = () => {
    const json = JSON.stringify(webhooks.map(w => w.raw), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `switch-webhooks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const testWebhook = async () => {
    const testData = {
      serial: "XKK10006076602",
      hos_version: "20.4.0",
      ams_version: "1.9.4",
      action: "Launch",
      title_id: "0100000000000000",
      title_version: "1.0.0",
      title_name: "Test Game - Monitor",
      controller_count: 1
    };

    try {
      const response = await fetch('/api/switch-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      if (response.ok) {
        console.log('[Monitor] Test webhook sent successfully');

        // Send exit after 2 seconds
        setTimeout(async () => {
          await fetch('/api/switch-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...testData, action: 'Exit' })
          });
        }, 2000);
      }
    } catch (error) {
      console.error('[Monitor] Test webhook failed:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🎮 Switch Webhook Monitor</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Real-time view of all incoming Nintendo Switch webhook payloads
        </p>
      </div>

      {/* Status Bar */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Badge variant="outline">
              {webhooks.length} webhooks received
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={testWebhook}
              variant="outline"
              size="sm"
            >
              Send Test
            </Button>

            <Button
              onClick={() => setAutoScroll(!autoScroll)}
              variant={autoScroll ? "default" : "outline"}
              size="sm"
            >
              Auto-scroll: {autoScroll ? 'ON' : 'OFF'}
            </Button>

            <Button
              onClick={downloadPayloads}
              variant="outline"
              size="sm"
              disabled={webhooks.length === 0}
            >
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>

            <Button
              onClick={clearWebhooks}
              variant="outline"
              size="sm"
              disabled={webhooks.length === 0}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </Card>

      {/* Production Webhook URLs */}
      <Card className="p-4 mb-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-2 border-green-500">
        <div className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">
              ✅ HTTP Bridge (Recommended for Switch):
            </p>
            <code className="text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border border-green-300 block">
              http://switch-webhook.brendonganle.workers.dev/
            </code>
            <p className="text-xs text-green-700 dark:text-green-400 mt-1">
              Uses HTTP to avoid SSL issues, automatically forwards to HTTPS production endpoint
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              Direct HTTPS Endpoint (Alternative):
            </p>
            <code className="text-xs bg-white dark:bg-gray-900 px-3 py-2 rounded border border-gray-300 block">
              https://sipnplay.cafe/api/switch-webhook
            </code>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Only if your Switch homebrew supports modern SSL/TLS certificates
            </p>
          </div>
        </div>
      </Card>

      {/* Webhook List */}
      <Card className="p-0 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b">
          <h2 className="font-semibold">Incoming Webhooks</h2>
        </div>

        <div className="h-[600px] overflow-y-auto" ref={scrollRef}>
          {webhooks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-4">No webhooks received yet</p>
              <p className="text-sm">Waiting for Nintendo Switch to send game events...</p>
            </div>
          ) : (
            <div className="divide-y">
              {webhooks.map((webhook) => (
                <div key={webhook.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Badge variant={webhook.action === 'started' ? 'default' : 'secondary'}>
                        {webhook.action === 'started' ? '🎮 LAUNCH' : '🛑 EXIT'}
                      </Badge>
                      <span className="font-semibold">{webhook.game.name}</span>
                      {webhook.player.controllerCount > 1 && (
                        <Badge variant="outline">
                          {webhook.player.controllerCount} controllers
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {new Date(webhook.timestamp).toLocaleTimeString()}
                      </span>
                      <Button
                        onClick={() => copyPayload(webhook)}
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                      >
                        {copied === webhook.id ? (
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2">
                    <details className="cursor-pointer">
                      <summary className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                        View raw JSON payload
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                        {JSON.stringify(webhook.raw, null, 2)}
                      </pre>
                    </details>
                  </div>

                  <div className="mt-2 flex gap-4 text-xs text-gray-500">
                    <span>Title ID: {webhook.game.titleId}</span>
                    <span>Serial: {webhook.player.serial}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}