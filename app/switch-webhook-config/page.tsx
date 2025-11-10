'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SwitchWebhookConfig() {
  // Static production webhook URL - this never changes
  const PRODUCTION_WEBHOOK_URL = 'https://sipnplay.cafe/api/switch-webhook';
  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [localIp, setLocalIp] = useState<string>('192.168.x.x');

  useEffect(() => {
    // Try to detect local IP for display purposes only
    if (typeof window !== 'undefined' && window.location.hostname !== 'sipnplay.cafe') {
      // If running locally, show the current host
      const port = window.location.port || '3000';
      setLocalIp(window.location.hostname);
    }
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(PRODUCTION_WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const testWebhook = async () => {
    setIsLoading(true);
    setTestStatus('');

    const testData = {
      serial: "XKK10006076602",
      hos_version: "20.4.0",
      ams_version: "1.9.4",
      action: "Launch",
      title_id: "01002EF01A316000",
      title_version: "1.0.1.3",
      title_name: "Test Game - Mario Kart 8",
      controller_count: 1
    };

    try {
      const response = await fetch('/api/switch-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });

      if (response.ok) {
        const result = await response.json();
        setTestStatus(`✅ Success! Notified ${result.clients || 0} connected clients.`);

        // Send exit event after 2 seconds
        setTimeout(async () => {
          await fetch('/api/switch-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...testData, action: 'Exit' })
          });
        }, 2000);
      } else {
        setTestStatus('❌ Failed to send test webhook');
      }
    } catch (error) {
      setTestStatus('❌ Error: ' + error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Nintendo Switch Webhook Configuration</h1>

      <div className="grid gap-6 max-w-4xl">
        {/* Webhook URL Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">🎮 Production Webhook URL (Use This!)</h2>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg mb-4">
            <p className="text-sm text-green-700 dark:text-green-400 mb-2 font-semibold">✅ Configure your Switch homebrew to send webhooks to:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white dark:bg-gray-900 p-3 rounded font-mono text-sm break-all border-2 border-green-500">
                {PRODUCTION_WEBHOOK_URL}
              </code>
              <Button
                onClick={copyToClipboard}
                variant="outline"
                className="shrink-0 border-green-500 text-green-700 hover:bg-green-50"
              >
                {copied ? '✓ Copied!' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold">📍 This URL is permanent and will never change</p>
            <p className="text-gray-600 dark:text-gray-400">It works from anywhere in the world as long as your Switch has internet access</p>
          </div>
        </Card>

        {/* Local Testing Card */}
        <Card className="p-6 bg-blue-50 dark:bg-blue-900/20">
          <h2 className="text-lg font-semibold mb-4">🏠 Local Testing (Optional)</h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            For testing on your local network before deploying:
          </p>

          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg">
            <code className="font-mono text-sm text-blue-600 dark:text-blue-400">
              http://{localIp}:3000/api/switch-webhook
            </code>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Replace {localIp} with your computer's actual IP address (run 'ipconfig' on Windows or 'ifconfig' on Mac/Linux)
          </p>
        </Card>

        {/* Test Webhook Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">🧪 Test Notifications</h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Click the button below to send a test notification. Make sure you have the website open in another tab to see the toast notification.
          </p>

          <div className="flex items-center gap-4">
            <Button
              onClick={testWebhook}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Sending...' : 'Send Test Notification'}
            </Button>

            {testStatus && (
              <p className="text-sm">{testStatus}</p>
            )}
          </div>
        </Card>

        {/* Payload Format Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">📊 Expected Webhook Payload</h2>

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Your Switch homebrew should send a POST request with this JSON format:
          </p>

          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto text-xs">
{JSON.stringify({
  serial: "XKK10006076602",
  hos_version: "20.4.0",
  ams_version: "1.9.4",
  action: "Launch or Exit",
  title_id: "01002EF01A316000",
  title_version: "1.0.1.3",
  title_name: "Game Name",
  controller_count: 2
}, null, 2)}
          </pre>

          <div className="mt-4 space-y-2 text-sm">
            <p><strong>Actions:</strong></p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li><code>"Launch"</code> - Shows "Someone just started playing [Game]"</li>
              <li><code>"Exit"</code> - Shows "Someone just finished playing [Game]"</li>
            </ul>
          </div>
        </Card>

        {/* Integration Status Card */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">📡 Integration Status</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Webhook endpoint is active</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Real-time notifications enabled (SSE)</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm">Toast notifications configured</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong>Tip:</strong> Open the website in multiple browser tabs to test that notifications appear for all users simultaneously.
            </p>
          </div>
        </Card>

      </div>
    </div>
  );
}