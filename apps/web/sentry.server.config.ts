/**
 * Sentry Server-side Configuration
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: process.env.NODE_ENV === 'development',

  // Don't send data to Sentry in development
  enabled: process.env.NODE_ENV === 'production',

  // Set environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.VERCEL_GIT_COMMIT_SHA || 'development',

  // Add tags for filtering
  initialScope: {
    tags: {
      app: 'marketing-pilot-web',
      runtime: 'nodejs',
    },
  },

  // Filter out certain errors
  ignoreErrors: [
    // Expected HTTP errors
    /^(4|5)\d{2}$/,
    // Supabase auth errors that are expected
    'AuthApiError',
    'AuthSessionMissingError',
  ],

  // Before send hook for additional filtering/enrichment
  beforeSend(event, hint) {
    // Don't send errors in development
    if (process.env.NODE_ENV !== 'production') {
      return null;
    }

    // Filter out certain error types
    const error = hint.originalException;
    if (error instanceof Error) {
      // Skip certain expected errors
      if (
        error.message?.includes('NEXT_NOT_FOUND') ||
        error.message?.includes('NEXT_REDIRECT')
      ) {
        return null;
      }
    }

    return event;
  },

  // Integrations
  integrations: [
    // Add any server-specific integrations here
  ],
});
