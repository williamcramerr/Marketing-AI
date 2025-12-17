import { Heading, Text, Section } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/base-layout';
import { Button } from '../components/button';

interface ApprovalRequestEmailProps {
  userName?: string;
  requestorName?: string;
  taskTitle?: string;
  taskType?: string;
  campaignName?: string;
  approvalUrl?: string;
  previewContent?: string;
  dueDate?: string;
}

export function ApprovalRequestEmail({
  userName = 'there',
  requestorName = 'Marketing Pilot AI',
  taskTitle = 'Blog Post: 10 Marketing Trends',
  taskType = 'blog_post',
  campaignName = 'Q1 Launch Campaign',
  approvalUrl = 'https://app.marketingpilot.ai/dashboard/approvals/123',
  previewContent = 'Marketing is evolving rapidly in 2024...',
  dueDate,
}: ApprovalRequestEmailProps) {
  return (
    <BaseLayout preview={`Approval needed: ${taskTitle}`}>
      <Section style={content}>
        <Section style={urgentBadge}>
          <Text style={urgentText}>Approval Required</Text>
        </Section>
        <Heading style={heading}>Content Needs Your Review</Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          {requestorName} has submitted content that needs your approval before
          it can be published.
        </Text>
        <Section style={taskBox}>
          <Text style={taskLabel}>Content</Text>
          <Text style={taskValue}>{taskTitle}</Text>
          <Text style={taskLabel}>Campaign</Text>
          <Text style={taskValue}>{campaignName}</Text>
          <Text style={taskLabel}>Type</Text>
          <Text style={taskValue}>{taskType.replace('_', ' ')}</Text>
          {dueDate && (
            <>
              <Text style={taskLabel}>Due By</Text>
              <Text style={{ ...taskValue, color: '#dc3545' }}>{dueDate}</Text>
            </>
          )}
        </Section>
        {previewContent && (
          <Section style={previewBox}>
            <Text style={previewLabel}>Content Preview</Text>
            <Text style={previewText}>{previewContent}</Text>
          </Section>
        )}
        <Section style={buttonContainer}>
          <Button href={approvalUrl}>Review & Approve</Button>
        </Section>
        <Text style={actionInfo}>
          You can approve, request changes, or reject this content from the
          approval dashboard.
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default ApprovalRequestEmail;

const content: React.CSSProperties = {
  padding: '24px 0',
};

const urgentBadge: React.CSSProperties = {
  backgroundColor: '#fff3cd',
  borderRadius: '4px',
  padding: '8px 16px',
  display: 'inline-block',
  marginBottom: '16px',
};

const urgentText: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  margin: '0',
  color: '#856404',
};

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0 0 24px',
};

const paragraph: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#525f7f',
  margin: '0 0 16px',
};

const taskBox: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
};

const taskLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '0 0 4px',
  textTransform: 'uppercase',
};

const taskValue: React.CSSProperties = {
  fontSize: '14px',
  color: '#1a1a1a',
  margin: '0 0 12px',
  fontWeight: '500',
};

const previewBox: React.CSSProperties = {
  border: '1px solid #e6ebf1',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
};

const previewLabel: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '0 0 8px',
  textTransform: 'uppercase',
};

const previewText: React.CSSProperties = {
  fontSize: '14px',
  color: '#525f7f',
  margin: '0',
  fontStyle: 'italic',
};

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
};

const actionInfo: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  textAlign: 'center',
  margin: '0',
};
