'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface GameNotification {
  type: string;
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
  timestamp: string;
}

interface ToastItem {
  id: string;
  notification: GameNotification;
}

export function SwitchGameToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connectSSE = () => {
      eventSource = new EventSource('/api/switch-notifications');

      eventSource.onopen = () => {
        console.log('[SwitchGameToast] Connected to notifications');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'switch_game') {
            const toastItem: ToastItem = {
              id: `${Date.now()}-${Math.random()}`,
              notification: data,
            };

            // Add new toast
            setToasts(prev => [...prev, toastItem]);

            // Remove after 5 seconds
            setTimeout(() => {
              setToasts(prev => prev.filter(t => t.id !== toastItem.id));
            }, 5000);
          }
        } catch (error) {
          console.error('[SwitchGameToast] Error parsing message:', error);
        }
      };

      eventSource.onerror = () => {
        console.log('[SwitchGameToast] Connection error, reconnecting...');
        eventSource?.close();
        // Reconnect after 5 seconds
        setTimeout(connectSSE, 5000);
      };
    };

    // Connect on mount
    connectSSE();

    // Cleanup on unmount
    return () => {
      eventSource?.close();
    };
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-50 space-y-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="flex items-center gap-3 bg-gray-900 text-white p-3 rounded-lg shadow-xl max-w-sm animate-slide-in-left pointer-events-auto"
          style={{
            animation: 'slideInLeft 0.3s ease-out, fadeOut 0.5s ease-in 4.5s forwards'
          }}
        >
          {/* Game Thumbnail */}
          <div className="flex-shrink-0">
            {toast.notification.game.image ? (
              <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-800">
                <Image
                  src={toast.notification.game.image}
                  alt={toast.notification.game.name}
                  fill
                  className="object-cover"
                  sizes="48px"
                />
              </div>
            ) : (
              <div className="w-12 h-12 rounded bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2C5.58 2 2 5.58 2 10s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm-1 13v-2h2v2H9zm0-4V7h2v4H9z"/>
                </svg>
              </div>
            )}
          </div>

          {/* Notification Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {toast.notification.action === 'started' ? (
                <>
                  <span className="text-green-400">🎮</span> Someone just started playing
                </>
              ) : (
                <>
                  <span className="text-orange-400">🛑</span> Someone just finished playing
                </>
              )}
            </p>
            <p className="text-xs text-gray-300 truncate font-semibold">
              {toast.notification.game.name}
            </p>
            {toast.notification.player.controllerCount > 1 && (
              <p className="text-xs text-gray-400 mt-1">
                with {toast.notification.player.controllerCount} controllers
              </p>
            )}
          </div>

          {/* Nintendo Switch Icon */}
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M4.5 3C3.12 3 2 4.12 2 5.5v13C2 19.88 3.12 21 4.5 21h15c1.38 0 2.5-1.12 2.5-2.5v-13C22 4.12 20.88 3 19.5 3h-15zM5 7h4v10H5V7zm14 0v10h-8V7h8zm-9 2c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1zm7 0c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
            </svg>
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes slideInLeft {
          from {
            transform: translateX(-100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          to {
            opacity: 0;
            transform: translateX(-20px);
          }
        }
      `}</style>
    </div>
  );
}