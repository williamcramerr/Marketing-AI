'use client';

/**
 * Error Boundary Component
 *
 * Catches and handles React errors gracefully, integrating with Sentry
 * for error tracking and providing a user-friendly fallback UI.
 */

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Error fallback component for Next.js App Router error boundaries
 */
export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error, {
      tags: {
        errorBoundary: 'app',
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-4">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
        </div>

        <h2 className="mb-2 text-2xl font-semibold text-gray-900">
          Something went wrong
        </h2>

        <p className="mb-6 text-gray-600">
          We apologize for the inconvenience. Our team has been notified and is
          working to fix the issue.
        </p>

        {process.env.NODE_ENV === 'development' && (
          <div className="mb-6 rounded-lg bg-gray-100 p-4 text-left">
            <p className="mb-2 text-sm font-medium text-gray-700">
              Error details:
            </p>
            <pre className="overflow-auto whitespace-pre-wrap text-xs text-red-600">
              {error.message}
            </pre>
            {error.digest && (
              <p className="mt-2 text-xs text-gray-500">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => reset()}
            variant="default"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>

          <Button
            onClick={() => (window.location.href = '/dashboard')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            Go to Dashboard
          </Button>
        </div>

        {error.digest && (
          <p className="mt-6 text-xs text-gray-400">
            If this problem persists, please contact support with error ID:{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5">
              {error.digest}
            </code>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Global error component for the root error.tsx
 */
export function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: {
        errorBoundary: 'global',
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-8">
          <div className="max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-red-100 p-4">
                <AlertTriangle className="h-12 w-12 text-red-600" />
              </div>
            </div>

            <h2 className="mb-2 text-2xl font-semibold text-gray-900">
              Application Error
            </h2>

            <p className="mb-6 text-gray-600">
              A critical error has occurred. Please try refreshing the page.
            </p>

            <button
              onClick={() => reset()}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </button>

            {error.digest && (
              <p className="mt-6 text-xs text-gray-400">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
