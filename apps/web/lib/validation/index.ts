/**
 * Validation Module
 *
 * Centralized input validation using Zod schemas.
 *
 * @example
 * import { validateBody, createTaskSchema } from '@/lib/validation';
 *
 * export async function POST(request: NextRequest) {
 *   const result = await validateBody(request, createTaskSchema);
 *   if (!result.success) return result.response;
 *
 *   const task = result.data; // Fully typed!
 *   // ...
 * }
 */

// Common schemas
export {
  uuidSchema,
  optionalUuidSchema,
  paginationSchema,
  isoDateSchema,
  optionalIsoDateSchema,
  futureDateSchema,
  emailSchema,
  urlSchema,
  nonEmptyStringSchema,
  titleSchema,
  descriptionSchema,
  prioritySchema,
  slugSchema,
  booleanStringSchema,
  jsonObjectSchema,
  sortDirectionSchema,
  idParamSchema,
} from './schemas/common';

// Task schemas
export {
  TASK_TYPES,
  TASK_STATUSES,
  type TaskType,
  type TaskStatus,
  taskTypeSchema,
  taskStatusSchema,
  createTaskSchema,
  updateTaskSchema,
  listTasksQuerySchema,
  bulkTaskInputSchema,
  bulkCreateTasksSchema,
  triggerTaskSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type ListTasksQuery,
  type BulkCreateTasksInput,
  type TriggerTaskInput,
} from './schemas/task';

// Connector schemas
export {
  CONNECTOR_TYPES,
  CONNECTOR_STATUSES,
  type ConnectorType,
  type ConnectorStatus,
  connectorTypeSchema,
  connectorStatusSchema,
  rateLimitConfigSchema,
  emailCredentialsSchema,
  cmsCredentialsSchema,
  socialCredentialsSchema,
  analyticsCredentialsSchema,
  advertisingCredentialsSchema,
  getCredentialsSchema,
  createConnectorSchema,
  updateConnectorSchema,
  testConnectorSchema,
  listConnectorsQuerySchema,
  validateConnectorCredentials,
  type CreateConnectorInput,
  type UpdateConnectorInput,
  type TestConnectorInput,
  type ListConnectorsQuery,
} from './schemas/connector';

// Campaign schemas
export {
  CAMPAIGN_STATUSES,
  CAMPAIGN_GOALS,
  type CampaignStatus,
  type CampaignGoal,
  campaignStatusSchema,
  campaignGoalSchema,
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsQuerySchema,
  createProductSchema,
  updateProductSchema,
  type CreateCampaignInput,
  type UpdateCampaignInput,
  type ListCampaignsQuery,
  type CreateProductInput,
  type UpdateProductInput,
} from './schemas/campaign';

// Validation middleware
export {
  formatZodErrors,
  createValidationErrorResponse,
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  withValidation,
  type ValidationErrorResponse,
  type InferValidated,
} from './middleware';
