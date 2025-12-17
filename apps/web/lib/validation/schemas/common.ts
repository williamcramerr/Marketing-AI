/**
 * Common Zod Schemas
 *
 * Reusable validation schemas for common types like UUIDs, pagination,
 * dates, and other shared validations.
 */

import { z } from 'zod';

/**
 * UUID validation schema
 */
export const uuidSchema = z
  .string()
  .uuid({ message: 'Invalid UUID format' });

/**
 * Optional UUID that can be null or undefined
 */
export const optionalUuidSchema = uuidSchema.optional().nullable();

/**
 * Pagination schema for query parameters
 */
export const paginationSchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 50))
    .pipe(z.number().min(1).max(100).default(50)),
  offset: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 0))
    .pipe(z.number().min(0).default(0)),
});

/**
 * Date string validation (ISO 8601 format)
 */
export const isoDateSchema = z
  .string()
  .datetime({ message: 'Invalid ISO 8601 date format' });

/**
 * Optional date string
 */
export const optionalIsoDateSchema = isoDateSchema.optional().nullable();

/**
 * Future date validation
 */
export const futureDateSchema = z
  .string()
  .datetime()
  .refine(
    (date) => new Date(date) > new Date(),
    { message: 'Date must be in the future' }
  );

/**
 * Email validation
 */
export const emailSchema = z
  .string()
  .email({ message: 'Invalid email address' })
  .max(255, { message: 'Email must be 255 characters or less' });

/**
 * URL validation
 */
export const urlSchema = z
  .string()
  .url({ message: 'Invalid URL format' })
  .max(2048, { message: 'URL must be 2048 characters or less' });

/**
 * Non-empty string with trimming
 */
export const nonEmptyStringSchema = z
  .string()
  .trim()
  .min(1, { message: 'This field is required' });

/**
 * Title validation (1-200 characters)
 */
export const titleSchema = z
  .string()
  .trim()
  .min(1, { message: 'Title is required' })
  .max(200, { message: 'Title must be 200 characters or less' });

/**
 * Description validation (optional, up to 5000 characters)
 */
export const descriptionSchema = z
  .string()
  .trim()
  .max(5000, { message: 'Description must be 5000 characters or less' })
  .optional()
  .nullable();

/**
 * Priority validation (1-100)
 */
export const prioritySchema = z
  .number()
  .int()
  .min(1, { message: 'Priority must be at least 1' })
  .max(100, { message: 'Priority must be at most 100' })
  .default(50);

/**
 * Slug validation (lowercase alphanumeric with hyphens)
 */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    { message: 'Slug must be lowercase alphanumeric with hyphens' }
  );

/**
 * Boolean string conversion for query params
 */
export const booleanStringSchema = z
  .string()
  .optional()
  .transform((val) => val === 'true');

/**
 * JSON object schema (for arbitrary JSON data)
 */
export const jsonObjectSchema = z.record(z.unknown()).default({});

/**
 * Sort direction schema
 */
export const sortDirectionSchema = z.enum(['asc', 'desc']).default('desc');

/**
 * Generic ID parameter schema for route params
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});
