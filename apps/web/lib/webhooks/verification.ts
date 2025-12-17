/**
 * Webhook Signature Verification
 *
 * Provides secure webhook signature verification for:
 * - Resend (Svix format)
 * - Stripe
 * - Generic HMAC SHA256
 *
 * All verifications use constant-time comparison to prevent timing attacks.
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verification result
 */
export interface VerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Maximum age for webhook timestamps (5 minutes)
 */
const MAX_TIMESTAMP_AGE_SECONDS = 300;

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  try {
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');

    if (bufferA.length !== bufferB.length) {
      return false;
    }

    return timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

/**
 * Verify timestamp is within acceptable range
 */
function isTimestampValid(timestamp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const age = Math.abs(now - timestamp);
  return age <= MAX_TIMESTAMP_AGE_SECONDS;
}

/**
 * Compute HMAC SHA256 signature
 */
function computeHmacSha256(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64');
}

/**
 * Compute HMAC SHA256 signature as hex
 */
function computeHmacSha256Hex(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify Svix webhook signature (used by Resend)
 *
 * Svix signature format:
 * - Header: svix-signature (e.g., "v1=signature1,v1=signature2")
 * - Header: svix-timestamp (Unix timestamp in seconds)
 * - Header: svix-id (Webhook ID)
 *
 * Signature payload: "{webhookId}.{timestamp}.{body}"
 */
export function verifySvixSignature({
  payload,
  signature,
  timestamp,
  webhookId,
  secret,
}: {
  payload: string;
  signature: string | null;
  timestamp: string | null;
  webhookId: string | null;
  secret: string;
}): VerificationResult {
  // Check required headers
  if (!signature || !timestamp || !webhookId) {
    return {
      valid: false,
      error: 'Missing required Svix headers (svix-signature, svix-timestamp, svix-id)',
    };
  }

  // Parse timestamp
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  // Verify timestamp freshness
  if (!isTimestampValid(timestampNum)) {
    return {
      valid: false,
      error: 'Webhook timestamp is too old or in the future',
    };
  }

  // Extract signatures from header (can have multiple v1= signatures)
  const signatures = signature
    .split(',')
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.substring(3)); // Remove 'v1=' prefix

  if (signatures.length === 0) {
    return { valid: false, error: 'No v1 signature found in header' };
  }

  // Compute expected signature
  // Svix signs: "{webhook_id}.{timestamp}.{body}"
  const signedPayload = `${webhookId}.${timestamp}.${payload}`;

  // Decode the secret if it starts with "whsec_"
  let decodedSecret = secret;
  if (secret.startsWith('whsec_')) {
    decodedSecret = Buffer.from(secret.substring(6), 'base64').toString('utf8');
  }

  const expectedSignature = computeHmacSha256(decodedSecret, signedPayload);

  // Check if any of the provided signatures match
  const isValid = signatures.some((sig) => constantTimeCompare(sig, expectedSignature));

  if (!isValid) {
    return { valid: false, error: 'Signature verification failed' };
  }

  return { valid: true };
}

/**
 * Verify Stripe webhook signature
 *
 * Stripe signature format:
 * - Header: stripe-signature (e.g., "t=timestamp,v1=signature")
 *
 * Signature payload: "{timestamp}.{body}"
 */
export function verifyStripeSignature({
  payload,
  signature,
  secret,
}: {
  payload: string;
  signature: string | null;
  secret: string;
}): VerificationResult {
  if (!signature) {
    return { valid: false, error: 'Missing Stripe signature header' };
  }

  // Parse signature header
  const elements = signature.split(',');
  const elementsMap: Record<string, string> = {};

  for (const element of elements) {
    const [key, value] = element.split('=');
    if (key && value) {
      elementsMap[key] = value;
    }
  }

  const timestamp = elementsMap['t'];
  const signatureV1 = elementsMap['v1'];

  if (!timestamp || !signatureV1) {
    return {
      valid: false,
      error: 'Invalid Stripe signature format (missing t or v1)',
    };
  }

  // Verify timestamp freshness
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum) || !isTimestampValid(timestampNum)) {
    return {
      valid: false,
      error: 'Webhook timestamp is too old or in the future',
    };
  }

  // Compute expected signature
  // Stripe signs: "{timestamp}.{body}"
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = computeHmacSha256Hex(secret, signedPayload);

  if (!constantTimeCompare(signatureV1, expectedSignature)) {
    return { valid: false, error: 'Signature verification failed' };
  }

  return { valid: true };
}

/**
 * Verify generic HMAC SHA256 signature
 *
 * For webhooks that use simple HMAC verification.
 */
export function verifyHmacSignature({
  payload,
  signature,
  secret,
  encoding = 'hex',
}: {
  payload: string;
  signature: string | null;
  secret: string;
  encoding?: 'hex' | 'base64';
}): VerificationResult {
  if (!signature) {
    return { valid: false, error: 'Missing signature header' };
  }

  // Compute expected signature
  const expectedSignature =
    encoding === 'hex'
      ? computeHmacSha256Hex(secret, payload)
      : computeHmacSha256(secret, payload);

  // Handle signature with prefix (e.g., "sha256=signature")
  let actualSignature = signature;
  if (signature.includes('=')) {
    actualSignature = signature.split('=').pop() || signature;
  }

  if (!constantTimeCompare(actualSignature, expectedSignature)) {
    return { valid: false, error: 'Signature verification failed' };
  }

  return { valid: true };
}

/**
 * Verify webhook with timestamp validation
 *
 * Generic verification that includes timestamp freshness check.
 */
export function verifyWebhookWithTimestamp({
  payload,
  signature,
  timestamp,
  secret,
  algorithm = 'sha256',
}: {
  payload: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  algorithm?: 'sha256';
}): VerificationResult {
  if (!signature) {
    return { valid: false, error: 'Missing signature header' };
  }

  if (!timestamp) {
    return { valid: false, error: 'Missing timestamp header' };
  }

  // Verify timestamp
  const timestampNum = parseInt(timestamp, 10);
  if (isNaN(timestampNum) || !isTimestampValid(timestampNum)) {
    return {
      valid: false,
      error: 'Webhook timestamp is too old or in the future',
    };
  }

  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = computeHmacSha256Hex(secret, signedPayload);

  if (!constantTimeCompare(signature, expectedSignature)) {
    return { valid: false, error: 'Signature verification failed' };
  }

  return { valid: true };
}
