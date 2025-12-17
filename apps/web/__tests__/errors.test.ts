import { describe, it, expect } from 'vitest';
import {
  ApplicationError,
  createErrorResponse,
  getUserFriendlyMessage,
  isRetryableError,
  withRetry,
  safeJsonParse,
} from '@/lib/errors';

describe('ApplicationError', () => {
  it('should create an error with code and message', () => {
    const error = new ApplicationError('NOT_FOUND', 'Resource not found');

    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Resource not found');
    expect(error.name).toBe('ApplicationError');
  });

  it('should include details when provided', () => {
    const error = new ApplicationError('VALIDATION_ERROR', 'Invalid input', {
      field: 'email',
      value: 'invalid',
    });

    expect(error.details).toEqual({ field: 'email', value: 'invalid' });
  });

  it('should convert to JSON correctly', () => {
    const error = new ApplicationError('FORBIDDEN', 'Access denied', { role: 'user' });
    const json = error.toJSON();

    expect(json).toEqual({
      code: 'FORBIDDEN',
      message: 'Access denied',
      details: { role: 'user' },
    });
  });
});

describe('createErrorResponse', () => {
  it('should create response from ApplicationError', () => {
    const error = new ApplicationError('NOT_FOUND', 'User not found');
    const response = createErrorResponse(error);

    expect(response.status).toBe(404);
    expect(response.error.code).toBe('NOT_FOUND');
  });

  it('should handle generic Error', () => {
    const error = new Error('Something went wrong');
    const response = createErrorResponse(error);

    expect(response.status).toBe(500);
    expect(response.error.code).toBe('INTERNAL_ERROR');
  });

  it('should handle Supabase duplicate error', () => {
    const error = { code: '23505', message: 'Duplicate key' };
    const response = createErrorResponse(error);

    expect(response.status).toBe(409);
    expect(response.error.code).toBe('DUPLICATE_ENTRY');
  });

  it('should handle Supabase not found error', () => {
    const error = { code: 'PGRST116', message: 'Not found' };
    const response = createErrorResponse(error);

    expect(response.status).toBe(404);
    expect(response.error.code).toBe('NOT_FOUND');
  });
});

describe('getUserFriendlyMessage', () => {
  it('should return friendly message for ApplicationError', () => {
    const error = new ApplicationError('RATE_LIMITED', 'Too many requests');
    const message = getUserFriendlyMessage(error);

    expect(message).toBe('Too many requests. Please wait a moment and try again');
  });

  it('should return default message for unknown error', () => {
    const error = { something: 'unexpected' };
    const message = getUserFriendlyMessage(error);

    expect(message).toBe('An unexpected error occurred. Please try again.');
  });
});

describe('isRetryableError', () => {
  it('should return true for rate limited errors', () => {
    const error = new ApplicationError('RATE_LIMITED', 'Too many requests');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return true for service unavailable errors', () => {
    const error = new ApplicationError('SERVICE_UNAVAILABLE', 'Try again later');
    expect(isRetryableError(error)).toBe(true);
  });

  it('should return false for validation errors', () => {
    const error = new ApplicationError('VALIDATION_ERROR', 'Invalid input');
    expect(isRetryableError(error)).toBe(false);
  });

  it('should return false for not found errors', () => {
    const error = new ApplicationError('NOT_FOUND', 'Resource not found');
    expect(isRetryableError(error)).toBe(false);
  });
});

describe('withRetry', () => {
  it('should return result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const result = await withRetry(fn, { maxRetries: 3 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new ApplicationError('RATE_LIMITED', 'Rate limited'))
      .mockResolvedValueOnce('success');

    const result = await withRetry(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on non-retryable errors', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new ApplicationError('NOT_FOUND', 'Not found'));

    await expect(withRetry(fn, { maxRetries: 3 })).rejects.toThrow('Not found');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max retries', async () => {
    const fn = vi.fn()
      .mockRejectedValue(new ApplicationError('RATE_LIMITED', 'Rate limited'));

    await expect(withRetry(fn, { maxRetries: 2, baseDelayMs: 10 })).rejects.toThrow('Rate limited');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });
});

describe('safeJsonParse', () => {
  it('should parse valid JSON', () => {
    const result = safeJsonParse('{"name": "test"}', { name: 'default' });
    expect(result).toEqual({ name: 'test' });
  });

  it('should return fallback for invalid JSON', () => {
    const result = safeJsonParse('invalid json', { name: 'default' });
    expect(result).toEqual({ name: 'default' });
  });

  it('should return fallback for empty string', () => {
    const result = safeJsonParse('', []);
    expect(result).toEqual([]);
  });
});
