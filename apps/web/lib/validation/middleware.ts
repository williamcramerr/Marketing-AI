/**
 * Validation Middleware
 *
 * Utilities for validating API request bodies, query parameters,
 * and route parameters using Zod schemas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError, ZodSchema } from 'zod';

/**
 * Validation error response format
 */
export interface ValidationErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: Record<string, string[]>;
  };
}

/**
 * Format Zod errors into a user-friendly structure
 */
export function formatZodErrors(error: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_root';
    if (!details[path]) {
      details[path] = [];
    }
    details[path].push(issue.message);
  }

  return details;
}

/**
 * Create a validation error response
 */
export function createValidationErrorResponse(
  error: ZodError,
  customMessage?: string
): NextResponse<ValidationErrorResponse> {
  return NextResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: customMessage || 'Invalid request data',
        details: formatZodErrors(error),
      },
    },
    { status: 400 }
  );
}

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse<ValidationErrorResponse> }
> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return {
        success: false,
        response: createValidationErrorResponse(result.error, 'Invalid request body'),
      };
    }

    return { success: true, data: result.data };
  } catch (error) {
    // JSON parsing error
    return {
      success: false,
      response: NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid JSON in request body',
            details: { _root: ['Request body must be valid JSON'] },
          },
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T extends ZodSchema>(
  request: NextRequest,
  schema: T
):
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse<ValidationErrorResponse> } {
  const searchParams = request.nextUrl.searchParams;
  const queryObject: Record<string, string | string[]> = {};

  // Convert URLSearchParams to a plain object
  searchParams.forEach((value, key) => {
    if (queryObject[key]) {
      // Handle multiple values for same key
      const existing = queryObject[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        queryObject[key] = [existing, value];
      }
    } else {
      queryObject[key] = value;
    }
  });

  const result = schema.safeParse(queryObject);

  if (!result.success) {
    return {
      success: false,
      response: createValidationErrorResponse(result.error, 'Invalid query parameters'),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate route parameters against a Zod schema
 */
export async function validateParams<T extends ZodSchema>(
  params: Promise<Record<string, string>> | Record<string, string>,
  schema: T
):Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: NextResponse<ValidationErrorResponse> }
> {
  const resolvedParams = await params;
  const result = schema.safeParse(resolvedParams);

  if (!result.success) {
    return {
      success: false,
      response: createValidationErrorResponse(result.error, 'Invalid route parameters'),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate multiple parts of a request
 */
export async function validateRequest<
  TBody extends ZodSchema,
  TQuery extends ZodSchema,
  TParams extends ZodSchema
>(
  request: NextRequest,
  options: {
    body?: TBody;
    query?: TQuery;
    params?: { schema: TParams; value: Promise<Record<string, string>> | Record<string, string> };
  }
): Promise<
  | {
      success: true;
      body?: z.infer<TBody>;
      query?: z.infer<TQuery>;
      params?: z.infer<TParams>;
    }
  | { success: false; response: NextResponse<ValidationErrorResponse> }
> {
  // Validate body if provided
  if (options.body) {
    const bodyResult = await validateBody(request, options.body);
    if (!bodyResult.success) {
      return bodyResult;
    }
  }

  // Validate query if provided
  if (options.query) {
    const queryResult = validateQuery(request, options.query);
    if (!queryResult.success) {
      return queryResult;
    }
  }

  // Validate params if provided
  if (options.params) {
    const paramsResult = await validateParams(options.params.value, options.params.schema);
    if (!paramsResult.success) {
      return paramsResult;
    }
  }

  // Build successful response
  const result: {
    success: true;
    body?: z.infer<TBody>;
    query?: z.infer<TQuery>;
    params?: z.infer<TParams>;
  } = { success: true };

  if (options.body) {
    const bodyResult = await validateBody(request, options.body);
    if (bodyResult.success) {
      result.body = bodyResult.data;
    }
  }

  if (options.query) {
    const queryResult = validateQuery(request, options.query);
    if (queryResult.success) {
      result.query = queryResult.data;
    }
  }

  if (options.params) {
    const paramsResult = await validateParams(options.params.value, options.params.schema);
    if (paramsResult.success) {
      result.params = paramsResult.data;
    }
  }

  return result;
}

/**
 * Higher-order function to wrap an API handler with validation
 */
export function withValidation<
  TBody extends ZodSchema,
  TQuery extends ZodSchema,
  TParams extends ZodSchema
>(
  options: {
    body?: TBody;
    query?: TQuery;
    params?: TParams;
  },
  handler: (
    request: NextRequest,
    validated: {
      body?: z.infer<TBody>;
      query?: z.infer<TQuery>;
      params?: z.infer<TParams>;
    },
    context?: { params: Promise<Record<string, string>> }
  ) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    const validated: {
      body?: z.infer<TBody>;
      query?: z.infer<TQuery>;
      params?: z.infer<TParams>;
    } = {};

    // Validate body if schema provided
    if (options.body) {
      const bodyResult = await validateBody(request, options.body);
      if (!bodyResult.success) {
        return bodyResult.response;
      }
      validated.body = bodyResult.data;
    }

    // Validate query if schema provided
    if (options.query) {
      const queryResult = validateQuery(request, options.query);
      if (!queryResult.success) {
        return queryResult.response;
      }
      validated.query = queryResult.data;
    }

    // Validate params if schema provided
    if (options.params && context?.params) {
      const paramsResult = await validateParams(context.params, options.params);
      if (!paramsResult.success) {
        return paramsResult.response;
      }
      validated.params = paramsResult.data;
    }

    // Call the handler with validated data
    return handler(request, validated, context);
  };
}

/**
 * Type helper for extracting the inferred type from a validation schema
 */
export type InferValidated<T extends ZodSchema> = z.infer<T>;
