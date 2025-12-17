import { Heading, Text, Section, Link } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/base-layout';
import { Button } from '../components/button';

interface TaskCompleteEmailProps {
  userName?: string;
  taskTitle?: string;
  taskType?: string;
  campaignName?: string;
  status?: 'completed' | 'failed';
  taskUrl?: string;
  previewContent?: string;
}

export function TaskCompleteEmail({
  userName = 'there',
  taskTitle = 'Blog Post: 10 Marketing Trends',
  taskType = 'blog_post',
  campaignName = 'Q1 Launch Campaign',
  status = 'completed',
  taskUrl = 'https://app.marketingpilot.ai/dashboard/tasks/123',
  previewContent = 'Marketing is evolving rapidly in 2024. Here are the top 10 trends you need to know...',
}: TaskCompleteEmailProps) {
  const isSuccess = status === 'completed';

  return (
    <BaseLayout
      preview={
        isSuccess
          ? `Your task "${taskTitle}" is ready for review`
          : `Task "${taskTitle}" needs attention`
      }
    >
      <Section style={content}>
        <Section style={isSuccess ? statusBadgeSuccess : statusBadgeError}>
          <Text style={statusText}>
            {isSuccess ? 'Task Completed' : 'Task Failed'}
          </Text>
        </Section>
        <Heading style={heading}>
          {isSuccess ? 'Your Content is Ready!' : 'Action Required'}
        </Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          {isSuccess
            ? `Your AI-generated content task has been completed and is ready for your review.`
            : `Unfortunately, there was an issue with your content task. Please review and try again.`}
        </Text>
        <Section style={taskBox}>
          <Text style={taskLabel}>Task</Text>
          <Text style={taskValue}>{taskTitle}</Text>
          <Text style={taskLabel}>Campaign</Text>
          <Text style={taskValue}>{campaignName}</Text>
          <Text style={taskLabel}>Type</Text>
          <Text style={taskValue}>{taskType.replace('_', ' ')}</Text>
        </Section>
        {isSuccess && previewContent && (
          <Section style={previewBox}>
            <Text style={previewLabel}>Preview</Text>
            <Text style={previewText}>{previewContent}</Text>
          </Section>
        )}
        <Section style={buttonContainer}>
          <Button href={taskUrl}>
            {isSuccess ? 'Review Content' : 'View Task'}
          </Button>
        </Section>
        <Text style={smallText}>
          {isSuccess
            ? 'Review and approve the content before it gets published.'
            : 'Check the error details and retry the task if needed.'}
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default TaskCompleteEmail;

const content: React.CSSProperties = {
  padding: '24px 0',
};

const statusBadgeSuccess: React.CSSProperties = {
  backgroundColor: '#d4edda',
  borderRadius: '4px',
  padding: '8px 16px',
  display: 'inline-block',
  marginBottom: '16px',
};

const statusBadgeError: React.CSSProperties = {
  backgroundColor: '#f8d7da',
  borderRadius: '4px',
  padding: '8px 16px',
  display: 'inline-block',
  marginBottom: '16px',
};

const statusText: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: '600',
  margin: '0',
  color: '#155724',
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

const smallText: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  textAlign: 'center',
  margin: '0',
};
