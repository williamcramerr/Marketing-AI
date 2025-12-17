/**
 * Task Validation Schemas
 *
 * Zod schemas for task-related API operations.
 */

import { z } from 'zod';
import {
  uuidSchema,
  optionalUuidSchema,
  titleSchema,
  descriptionSchema,
  prioritySchema,
  isoDateSchema,
  optionalIsoDateSchema,
  jsonObjectSchema,
  paginationSchema,
  booleanStringSchema,
} from './common';

/**
 * Valid task types enum
 */
export const TASK_TYPES = [
  'blog_post',
  'landing_page',
  'email_single',
  'email_sequence',
  'social_post',
  'seo_optimization',
  'ad_campaign',
  'research',
  'analysis',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

/**
 * Task type schema
 */
export const taskTypeSchema = z.enum(TASK_TYPES, {
  message: `Invalid task type. Must be one of: ${TASK_TYPES.join(', ')}`,
});

/**
 * Valid task statuses enum
 */
export const TASK_STATUSES = [
  'queued',
  'executing',
  'drafted',
  'pending_approval',
  'approved',
  'published',
  'failed',
  'cancelled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Task status schema
 */
export const taskStatusSchema = z.enum(TASK_STATUSES, {
  message: `Invalid task status. Must be one of: ${TASK_STATUSES.join(', ')}`,
});

/**
 * Task creation schema
 */
export const createTaskSchema = z.object({
  campaign_id: uuidSchema,
  type: taskTypeSchema,
  title: titleSchema,
  description: descriptionSchema,
  scheduled_for: optionalIsoDateSchema,
  input_data: jsonObjectSchema,
  priority: prioritySchema.optional(),
  connector_id: optionalUuidSchema,
  dry_run: z.boolean().default(false),
  trigger_workflow: z.boolean().default(false),
  idempotency_key: z.string().max(255).optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Task update schema
 */
export const updateTaskSchema = z.object({
  title: titleSchema.optional(),
  description: descriptionSchema,
  scheduled_for: optionalIsoDateSchema,
  input_data: jsonObjectSchema.optional(),
  priority: prioritySchema.optional(),
});

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

/**
 * Task list query params schema
 */
export const listTasksQuerySchema = paginationSchema.extend({
  campaign_id: z.string().uuid().optional(),
  status: taskStatusSchema.optional(),
  type: taskTypeSchema.optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

/**
 * Bulk task creation schema
 */
export const bulkTaskInputSchema = z.object({
  campaign_id: uuidSchema,
  type: taskTypeSchema,
  title: titleSchema,
  description: descriptionSchema,
  scheduled_for: optionalIsoDateSchema,
  input_data: jsonObjectSchema,
  priority: prioritySchema.optional(),
  connector_id: optionalUuidSchema,
  dry_run: z.boolean().default(false),
});

export const bulkCreateTasksSchema = z.object({
  tasks: z
    .array(bulkTaskInputSchema)
    .min(1, { message: 'At least one task is required' })
    .max(50, { message: 'Maximum 50 tasks per request' }),
  trigger_workflows: z.boolean().default(false),
});

export type BulkCreateTasksInput = z.infer<typeof bulkCreateTasksSchema>;

/**
 * Task trigger schema
 */
export const triggerTaskSchema = z.object({
  force: z.boolean().default(false),
});

export type TriggerTaskInput = z.infer<typeof triggerTaskSchema>;
