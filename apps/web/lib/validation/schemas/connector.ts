/**
 * Connector Validation Schemas
 *
 * Zod schemas for connector-related API operations.
 * Includes type-specific credential validation.
 */

import { z } from 'zod';
import {
  uuidSchema,
  titleSchema,
  descriptionSchema,
  jsonObjectSchema,
  urlSchema,
  emailSchema,
} from './common';

/**
 * Valid connector types
 */
export const CONNECTOR_TYPES = [
  'email',
  'cms',
  'social',
  'analytics',
  'advertising',
] as const;

export type ConnectorType = (typeof CONNECTOR_TYPES)[number];

/**
 * Connector type schema
 */
export const connectorTypeSchema = z.enum(CONNECTOR_TYPES, {
  message: `Invalid connector type. Must be one of: ${CONNECTOR_TYPES.join(', ')}`,
});

/**
 * Connector status enum
 */
export const CONNECTOR_STATUSES = [
  'active',
  'inactive',
  'error',
  'rate_limited',
] as const;

export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

export const connectorStatusSchema = z.enum(CONNECTOR_STATUSES);

/**
 * Rate limit configuration schema
 */
export const rateLimitConfigSchema = z.object({
  perHour: z.number().int().positive().optional(),
  perDay: z.number().int().positive().optional(),
}).optional();

/**
 * Credential schemas for each connector type
 */

// Email provider credentials (e.g., Resend)
export const emailCredentialsSchema = z.object({
  api_key: z.string().min(1, 'API key is required'),
  from_email: emailSchema.optional(),
  from_name: z.string().max(100).optional(),
});

// CMS credentials (e.g., WordPress, Ghost)
export const cmsCredentialsSchema = z.object({
  api_url: urlSchema,
  api_key: z.string().min(1, 'API key is required').optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  admin_key: z.string().optional(),
}).refine(
  (data) => data.api_key || (data.username && data.password) || data.admin_key,
  { message: 'Either API key, username/password, or admin key is required' }
);

// Social media credentials (e.g., LinkedIn, Twitter)
export const socialCredentialsSchema = z.object({
  oauth_connection_id: uuidSchema.optional(),
  access_token: z.string().optional(),
  access_token_secret: z.string().optional(),
  api_key: z.string().optional(),
  api_secret: z.string().optional(),
}).refine(
  (data) => data.oauth_connection_id || data.access_token || data.api_key,
  { message: 'Either OAuth connection, access token, or API key is required' }
);

// Analytics credentials
export const analyticsCredentialsSchema = z.object({
  api_key: z.string().min(1, 'API key is required').optional(),
  property_id: z.string().optional(),
  oauth_connection_id: uuidSchema.optional(),
}).refine(
  (data) => data.api_key || data.oauth_connection_id,
  { message: 'Either API key or OAuth connection is required' }
);

// Advertising platform credentials (e.g., Google Ads, Meta Ads)
export const advertisingCredentialsSchema = z.object({
  oauth_connection_id: uuidSchema.optional(),
  developer_token: z.string().optional(),
  account_id: z.string().optional(),
  customer_id: z.string().optional(),
  api_key: z.string().optional(),
}).refine(
  (data) => data.oauth_connection_id || data.api_key,
  { message: 'Either OAuth connection or API key is required' }
);

/**
 * Get credentials schema based on connector type
 */
export function getCredentialsSchema(type: ConnectorType) {
  switch (type) {
    case 'email':
      return emailCredentialsSchema;
    case 'cms':
      return cmsCredentialsSchema;
    case 'social':
      return socialCredentialsSchema;
    case 'analytics':
      return analyticsCredentialsSchema;
    case 'advertising':
      return advertisingCredentialsSchema;
    default:
      return jsonObjectSchema;
  }
}

/**
 * Connector creation schema
 */
export const createConnectorSchema = z.object({
  name: titleSchema,
  type: connectorTypeSchema,
  config: jsonObjectSchema,
  credentials: jsonObjectSchema,
  active: z.boolean().default(true),
  rate_limit: rateLimitConfigSchema,
});

export type CreateConnectorInput = z.infer<typeof createConnectorSchema>;

/**
 * Connector update schema
 */
export const updateConnectorSchema = z.object({
  name: titleSchema.optional(),
  config: jsonObjectSchema.optional(),
  credentials: jsonObjectSchema.optional(),
  active: z.boolean().optional(),
  rate_limit: rateLimitConfigSchema,
});

export type UpdateConnectorInput = z.infer<typeof updateConnectorSchema>;

/**
 * Connector test schema
 */
export const testConnectorSchema = z.object({
  type: connectorTypeSchema,
  credentials: jsonObjectSchema,
  config: jsonObjectSchema,
});

export type TestConnectorInput = z.infer<typeof testConnectorSchema>;

/**
 * Connector list query schema
 */
export const listConnectorsQuerySchema = z.object({
  type: connectorTypeSchema.optional(),
  active: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
});

export type ListConnectorsQuery = z.infer<typeof listConnectorsQuerySchema>;

/**
 * Validate connector credentials based on type
 */
export function validateConnectorCredentials(
  type: ConnectorType,
  credentials: unknown
) {
  const schema = getCredentialsSchema(type);
  return schema.safeParse(credentials);
}
