/**
 * Campaign Validation Schemas
 *
 * Zod schemas for campaign-related API operations.
 */

import { z } from 'zod';
import {
  uuidSchema,
  titleSchema,
  descriptionSchema,
  isoDateSchema,
  optionalIsoDateSchema,
  jsonObjectSchema,
  paginationSchema,
} from './common';

/**
 * Campaign status enum
 */
export const CAMPAIGN_STATUSES = [
  'draft',
  'active',
  'paused',
  'completed',
  'archived',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES, {
  errorMap: () => ({
    message: `Invalid campaign status. Must be one of: ${CAMPAIGN_STATUSES.join(', ')}`,
  }),
});

/**
 * Campaign goal type enum
 */
export const CAMPAIGN_GOALS = [
  'awareness',
  'engagement',
  'conversion',
  'retention',
  'research',
] as const;

export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number];

export const campaignGoalSchema = z.enum(CAMPAIGN_GOALS);

/**
 * Campaign creation schema
 */
export const createCampaignSchema = z.object({
  product_id: uuidSchema,
  name: titleSchema,
  description: descriptionSchema,
  goal: campaignGoalSchema.optional(),
  status: campaignStatusSchema.default('draft'),
  start_date: optionalIsoDateSchema,
  end_date: optionalIsoDateSchema,
  budget: z.number().positive().optional(),
  target_audience: z.string().max(2000).optional(),
  settings: jsonObjectSchema,
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/**
 * Campaign update schema
 */
export const updateCampaignSchema = z.object({
  name: titleSchema.optional(),
  description: descriptionSchema,
  goal: campaignGoalSchema.optional(),
  status: campaignStatusSchema.optional(),
  start_date: optionalIsoDateSchema,
  end_date: optionalIsoDateSchema,
  budget: z.number().positive().optional().nullable(),
  target_audience: z.string().max(2000).optional().nullable(),
  settings: jsonObjectSchema.optional(),
});

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

/**
 * Campaign list query schema
 */
export const listCampaignsQuerySchema = paginationSchema.extend({
  product_id: z.string().uuid().optional(),
  status: campaignStatusSchema.optional(),
  goal: campaignGoalSchema.optional(),
});

export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;

/**
 * Product creation schema
 */
export const createProductSchema = z.object({
  name: titleSchema,
  description: descriptionSchema,
  url: z.string().url().max(2048).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  target_audience: z.string().max(2000).optional().nullable(),
  value_proposition: z.string().max(2000).optional().nullable(),
  competitive_advantage: z.string().max(2000).optional().nullable(),
  settings: jsonObjectSchema,
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

/**
 * Product update schema
 */
export const updateProductSchema = z.object({
  name: titleSchema.optional(),
  description: descriptionSchema,
  url: z.string().url().max(2048).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  target_audience: z.string().max(2000).optional().nullable(),
  value_proposition: z.string().max(2000).optional().nullable(),
  competitive_advantage: z.string().max(2000).optional().nullable(),
  settings: jsonObjectSchema.optional(),
});

export type UpdateProductInput = z.infer<typeof updateProductSchema>;
