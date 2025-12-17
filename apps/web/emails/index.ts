/**
 * Email Template Exports
 *
 * All email templates for Marketing Pilot AI.
 */

// Components
export { BaseLayout } from './components/base-layout';
export { Header } from './components/header';
export { Footer } from './components/footer';
export { Button } from './components/button';

// Transactional emails
export { WelcomeEmail } from './transactional/welcome';
export { PasswordResetEmail } from './transactional/password-reset';
export { InviteEmail } from './transactional/invite';

// Notification emails
export { TaskCompleteEmail } from './notifications/task-complete';
export { ApprovalRequestEmail } from './notifications/approval-request';
export { UsageWarningEmail } from './notifications/usage-warning';
