import { Heading, Text, Section } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/base-layout';
import { Button } from '../components/button';

interface WelcomeEmailProps {
  userName?: string;
  dashboardUrl?: string;
}

export function WelcomeEmail({
  userName = 'there',
  dashboardUrl = 'https://app.marketingpilot.ai/dashboard',
}: WelcomeEmailProps) {
  return (
    <BaseLayout preview="Welcome to Marketing Pilot AI - Let's get started!">
      <Section style={content}>
        <Heading style={heading}>Welcome to Marketing Pilot AI!</Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          We&apos;re thrilled to have you on board! Marketing Pilot AI is your
          AI-powered marketing automation platform that helps you create,
          schedule, and publish content across all your marketing channels.
        </Text>
        <Text style={paragraph}>Here&apos;s what you can do:</Text>
        <ul style={list}>
          <li style={listItem}>
            <strong>Generate AI Content</strong> - Create blog posts, emails,
            and social content with Claude AI
          </li>
          <li style={listItem}>
            <strong>Automate Workflows</strong> - Schedule and publish content
            automatically
          </li>
          <li style={listItem}>
            <strong>Review & Approve</strong> - Human-in-the-loop approval for
            all AI-generated content
          </li>
        </ul>
        <Section style={buttonContainer}>
          <Button href={dashboardUrl}>Go to Dashboard</Button>
        </Section>
        <Text style={paragraph}>
          If you have any questions, our support team is here to help. Just
          reply to this email or visit our documentation.
        </Text>
        <Text style={signature}>
          Best,
          <br />
          The Marketing Pilot AI Team
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default WelcomeEmail;

const content: React.CSSProperties = {
  padding: '24px 0',
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

const list: React.CSSProperties = {
  margin: '0 0 24px',
  padding: '0 0 0 20px',
};

const listItem: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#525f7f',
  margin: '0 0 8px',
};

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
};

const signature: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#525f7f',
  margin: '24px 0 0',
};
