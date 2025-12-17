/**
 * Sentry Client-side Configuration
 *
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a users loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature
  replaysOnErrorSampleRate: 1.0,

  // This sets the sample rate to be 10% in production
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  // You can remove this option if you're not planning to use the Sentry Session Replay feature
  integrations: [
    Sentry.replayIntegration({
      // Additional Replay configuration goes in here
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filter out certain errors that are noisy or not actionable
  ignoreErrors: [
    // Random plugins/extensions
    'top.GLOBALS',
    // Browser extension noise
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // Network errors
    'NetworkError',
    'Network request failed',
    'Failed to fetch',
    'Load failed',
    // Aborted requests
    'AbortError',
    'The operation was aborted',
    // Script errors from cross-origin scripts
    'Script error.',
    'Script error',
    // User-caused errors
    'ResizeObserver loop',
    // Third party errors
    /^Non-Error promise rejection captured/,
  ],

  // Don't send data to Sentry in development
  enabled: process.env.NODE_ENV === 'production',

  // Set environment
  environment: process.env.NODE_ENV,

  // Release tracking
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'development',

  // Add tags for filtering
  initialScope: {
    tags: {
      app: 'marketing-pilot-web',
    },
  },
});
