'use client';

import { useState, useEffect } from 'react';
import { useAdminMode } from '@/lib/hooks/useAdminMode';
import { useRouter } from 'next/navigation';

export default function POSSettingsPage() {
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const isAdmin = useAdminMode();
  const router = useRouter();

  useEffect(() => {
    if (!isAdmin) {
      router.push('/');
      return;
    }

    // Load existing token
    const existingToken = localStorage.getItem('ipos_token');
    if (existingToken) {
      setToken(existingToken);
    }
  }, [isAdmin, router]);

  const handleSave = async () => {
    if (!token.trim()) {
      setError('Token cannot be empty');
      return;
    }

    try {
      // Save to localStorage
      localStorage.setItem('ipos_token', token.trim());

      setSaved(true);
      setError('');

      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('Failed to save token');
      console.error(err);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('ipos_token');
    setToken('');
    setSaved(false);
    setError('');
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            iPOS Settings
          </h1>
          <p className="text-gray-600 mb-8">
            Configure your iPOS API token for real-time POS data in the admin header.
          </p>

          <div className="space-y-6">
            <div>
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-2">
                iPOS API Token (JWT)
              </label>
              <textarea
                id="token"
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="mt-2 text-sm text-gray-500">
                Get your token from the iPOS dashboard at{' '}
                <a
                  href="https://fabi.ipos.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  fabi.ipos.vn
                </a>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {saved && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 text-sm">
                  ✅ Token saved successfully! The admin header will now display POS data.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleSave}
                className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Save Token
              </button>
              <button
                onClick={handleClear}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              How to get your token:
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>Log in to iPOS at fabi.ipos.vn</li>
              <li>Open browser DevTools (F12)</li>
              <li>Go to Application → Local Storage → fabi.ipos.vn</li>
              <li>Find the "token" key and copy its value</li>
              <li>Paste it in the field above and click Save</li>
            </ol>
            <p className="mt-4 text-sm text-gray-600">
              <strong>Note:</strong> Tokens typically expire after 7 days. You'll need to update it periodically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
