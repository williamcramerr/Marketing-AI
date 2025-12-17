/**
 * Structured Logging with Sentry Integration
 *
 * Provides a standardized logging interface that:
 * - Outputs structured JSON for Vercel logs
 * - Integrates with Sentry for error tracking
 * - Supports different log levels
 * - Adds contextual metadata
 */

import * as Sentry from '@sentry/nextjs';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  userId?: string;
  organizationId?: string;
  taskId?: string;
  connectorId?: string;
  requestId?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  data?: Record<string, unknown>;
}

/**
 * Logger class with Sentry integration
 */
class Logger {
  private defaultContext: LogContext = {};

  /**
   * Set default context that will be included in all log entries
   */
  setDefaultContext(context: LogContext) {
    this.defaultContext = { ...this.defaultContext, ...context };
  }

  /**
   * Clear default context
   */
  clearDefaultContext() {
    this.defaultContext = {};
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    const childLogger = new Logger();
    childLogger.setDefaultContext({ ...this.defaultContext, ...context });
    return childLogger;
  }

  /**
   * Format and output a log entry
   */
  private log(
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error
  ) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: Object.keys(this.defaultContext).length > 0 ? this.defaultContext : undefined,
      data: data && Object.keys(data).length > 0 ? data : undefined,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Output structured JSON for Vercel logs
    const output = JSON.stringify(entry);

    switch (level) {
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(output);
        }
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        // Send warnings to Sentry as breadcrumbs
        Sentry.addBreadcrumb({
          category: 'log',
          message,
          level: 'warning',
          data: { ...this.defaultContext, ...data },
        });
        break;
      case 'error':
        console.error(output);
        // Send errors to Sentry
        if (error) {
          Sentry.withScope((scope) => {
            // Add context to scope
            if (this.defaultContext.userId) {
              scope.setUser({ id: this.defaultContext.userId });
            }
            if (this.defaultContext.organizationId) {
              scope.setTag('organizationId', this.defaultContext.organizationId);
            }
            if (this.defaultContext.taskId) {
              scope.setTag('taskId', this.defaultContext.taskId);
            }
            if (data) {
              scope.setExtras(data);
            }
            Sentry.captureException(error);
          });
        } else {
          Sentry.withScope((scope) => {
            if (this.defaultContext.userId) {
              scope.setUser({ id: this.defaultContext.userId });
            }
            scope.setExtras({ ...this.defaultContext, ...data });
            Sentry.captureMessage(message, 'error');
          });
        }
        break;
    }
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, data?: Record<string, unknown>) {
    this.log('debug', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>) {
    this.log('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>) {
    this.log('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, errorOrData?: Error | Record<string, unknown>, data?: Record<string, unknown>) {
    if (errorOrData instanceof Error) {
      this.log('error', message, data, errorOrData);
    } else {
      this.log('error', message, errorOrData);
    }
  }

  /**
   * Track a metric/event
   */
  metric(name: string, value: number, tags?: Record<string, string>) {
    const entry = {
      type: 'metric',
      name,
      value,
      tags,
      timestamp: new Date().toISOString(),
      context: this.defaultContext,
    };

    console.info(JSON.stringify(entry));

    // Also send to Sentry
    Sentry.addBreadcrumb({
      category: 'metric',
      message: name,
      data: { value, ...tags },
      level: 'info',
    });
  }

  /**
   * Time an async operation
   */
  async time<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.metric(`${name}.duration`, duration, { status: 'success' });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.metric(`${name}.duration`, duration, { status: 'error' });

      throw error;
    }
  }
}

/**
 * Create a logger instance with optional context
 */
export function createLogger(context?: LogContext): Logger {
  const logger = new Logger();
  if (context) {
    logger.setDefaultContext(context);
  }
  return logger;
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Utility to log API request/response
 */
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  context?: LogContext
) {
  const requestLogger = createLogger(context);

  requestLogger.info('API Request', {
    method,
    path,
    statusCode,
    duration,
  });
}
