'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if already authenticated
  useEffect(() => {
    const staffName = localStorage.getItem('staff_name');
    if (staffName) {
      const redirectTo = searchParams.get('callbackUrl') || '/games?staff=true';
      router.push(redirectTo);
    }
  }, [router, searchParams]);

  // Get redirect URL from searchParams - deferring to effect
  const getRedirectUrl = () => {
    return searchParams.get('callbackUrl') || '/games?staff=true';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setIsLoading(true);

      // Verify email exists in Airtable Staff table
      const verifyResponse = await fetch('/api/staff/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!verifyResponse.ok) {
        setError('Email not found in staff directory');
        return;
      }

      const staffData = await verifyResponse.json();

      // Extract name from email (part before @)
      const nameParts = email.split('@')[0].split('.');
      const displayName = nameParts.map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');

      // Store in localStorage
      localStorage.setItem('staff_email', email);
      localStorage.setItem('staff_name', displayName);
      localStorage.setItem('staff_id', staffData.staffId); // Sip N Play Staff table record ID
      localStorage.setItem('staff_record_id', staffData.staffListRecordId); // SNP Games List StaffList table record ID (for Play Logs linking)

      // Store staff type (Admin or Staff)
      const staffType = staffData.type || 'Staff';
      localStorage.setItem('staff_type', staffType);

      setSuccess(true);
      setEmail('');

      // Redirect
      setTimeout(() => {
        router.push(getRedirectUrl());
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg border border-border shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Staff Access</h1>
            <p className="text-muted-foreground">Sign in with your email to access staff features</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 w-5 h-5 text-muted-foreground pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  disabled={isLoading || success}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-green-500/10 text-green-700 dark:text-green-400 rounded-lg text-sm">
                Signing in...
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : success ? (
                <>
                  <span>✓</span>
                  Redirecting...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Staff access only. Email verification not required for demo purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <SignInContent />
    </Suspense>
  );
}
