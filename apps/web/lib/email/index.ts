/**
 * Email Service Exports
 */

export {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendInviteEmail,
  sendTaskCompleteEmail,
  sendApprovalRequestEmail,
  sendUsageWarningEmail,
} from './send';

export type { SendEmailResult } from './send';
