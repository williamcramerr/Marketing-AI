import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import {
  taskWorkflow,
  taskApprovalHandler,
  heartbeatFunction,
  emergencyStopHandler,
} from '@/lib/inngest/functions';

// Create and export the API handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    taskWorkflow,
    taskApprovalHandler,
    heartbeatFunction,
    emergencyStopHandler,
  ],
});
