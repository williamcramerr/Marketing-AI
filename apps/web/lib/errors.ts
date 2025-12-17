/**
 * Custom application errors with structured error codes
 */

export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'DUPLICATE_ENTRY'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'WORKFLOW_ERROR';

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, any>;
}

export class ApplicationError extends Error {
  code: ErrorCode;
  details?: Record<string, any>;

  constructor(code: ErrorCode, message: string, details?: Record<string, any>) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.details = details;
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

/**
 * Error codes to HTTP status codes mapping
 */
export const errorToStatusCode: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  DUPLICATE_ENTRY: 409,
  EXTERNAL_SERVICE_ERROR: 502,
  WORKFLOW_ERROR: 500,
};

/**
 * Create an error response for API routes
 */
export function createErrorResponse(error: unknown): { error: AppError; status: number } {
  if (error instanceof ApplicationError) {
    return {
      error: error.toJSON(),
      status: errorToStatusCode[error.code],
    };
  }

  // Supabase error
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const supabaseError = error as { code: string; message: string };

    // Handle specific Supabase errors
    if (supabaseError.code === '23505') {
      return {
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'A record with this value already exists',
        },
        status: 409,
      };
    }

    if (supabaseError.code === 'PGRST116') {
      return {
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
        status: 404,
      };
    }
  }

  // Generic error
  if (error instanceof Error) {
    return {
      error: {
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
      },
      status: 500,
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
    status: 500,
  };
}

/**
 * User-friendly error messages
 */
export const userFriendlyMessages: Record<ErrorCode, string> = {
  UNAUTHORIZED: 'Please sign in to continue',
  FORBIDDEN: "You don't have permission to perform this action",
  NOT_FOUND: 'The requested resource was not found',
  VALIDATION_ERROR: 'Please check your input and try again',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again',
  INTERNAL_ERROR: 'Something went wrong. Please try again later',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later',
  DUPLICATE_ENTRY: 'This item already exists',
  EXTERNAL_SERVICE_ERROR: 'An external service is not responding. Please try again later',
  WORKFLOW_ERROR: 'The workflow encountered an error. Please check the task status',
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ApplicationError) {
    return userFriendlyMessages[error.code] || error.message;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: string }).code;
    if (code in userFriendlyMessages) {
      return userFriendlyMessages[code as ErrorCode];
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ApplicationError) {
    return ['RATE_LIMITED', 'SERVICE_UNAVAILABLE', 'EXTERNAL_SERVICE_ERROR'].includes(error.code);
  }

  // Network errors are usually retryable
  if (error instanceof Error && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 1000,
    maxDelayMs = 30000,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000, maxDelayMs);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Log error to console with structured format
 */
export function logError(context: string, error: unknown, extra?: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const errorInfo = error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { error };

  console.error(JSON.stringify({
    timestamp,
    context,
    ...errorInfo,
    ...extra,
  }));
}
