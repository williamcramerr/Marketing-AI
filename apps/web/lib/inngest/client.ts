import { Inngest, EventSchemas } from 'inngest';

// Event types for the marketing automation system
type Events = {
  'task/queued': {
    data: {
      taskId: string;
      organizationId: string;
    };
  };
  'task/workflow.start': {
    data: {
      taskId: string;
      organizationId: string;
      retry?: boolean;
    };
  };
  'task/approved': {
    data: {
      taskId: string;
      approverId: string;
    };
  };
  'task/rejected': {
    data: {
      taskId: string;
      reason: string;
    };
  };
  'campaign/started': {
    data: {
      campaignId: string;
      organizationId: string;
    };
  };
  'campaign/paused': {
    data: {
      campaignId: string;
    };
  };
  'heartbeat/tick': {
    data: {
      timestamp: string;
    };
  };
  'metrics/collected': {
    data: {
      taskId: string;
      metrics: Record<string, number>;
    };
  };
  'emergency/stop': {
    data: {
      organizationId: string;
      triggeredBy: string;
    };
  };
  // Growth Engine Events
  'social-listening/conversation-found': {
    data: {
      conversationId: string;
      configId: string;
      platform: string;
      intentLevel: 'low' | 'medium' | 'high';
    };
  };
  'social-listening/reply-approved': {
    data: {
      replyId: string;
      conversationId: string;
      connectorId?: string;
    };
  };
  'lead/captured': {
    data: {
      leadId: string;
      leadMagnetId: string;
      email: string;
      organizationId: string;
    };
  };
  'nurture/email-due': {
    data: {
      leadId: string;
      sequenceId: string;
      emailId: string;
      organizationId: string;
    };
  };
  'nurture/email-sent': {
    data: {
      leadId: string;
      emailId: string;
      messageId: string;
    };
  };
  'visitor/identified': {
    data: {
      visitorId: string;
      organizationId: string;
      companyDomain: string;
      fitScore?: number;
    };
  };
  'visitor/alert-triggered': {
    data: {
      alertId: string;
      visitorId: string;
      organizationId: string;
    };
  };
  'seo/keyword-research': {
    data: {
      keywordId: string;
      keyword: string;
      productId: string;
    };
  };
  'seo/brief-generated': {
    data: {
      briefId: string;
      keywordId: string;
      productId: string;
    };
  };
  'referral/conversion': {
    data: {
      referralId: string;
      linkId: string;
      referrerUserId: string;
    };
  };
  'partnership/outreach-sent': {
    data: {
      outreachId: string;
      opportunityId: string;
      organizationId: string;
    };
  };
};

// Create the Inngest client
export const inngest = new Inngest({
  id: 'marketing-pilot-ai',
  schemas: new EventSchemas().fromRecord<Events>(),
});

export type { Events };
