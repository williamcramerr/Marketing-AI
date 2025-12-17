import { Heading, Text, Section } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/base-layout';
import { Button } from '../components/button';

interface InviteEmailProps {
  inviterName?: string;
  organizationName?: string;
  role?: string;
  inviteUrl?: string;
  expiresInDays?: number;
}

export function InviteEmail({
  inviterName = 'Someone',
  organizationName = 'Acme Inc',
  role = 'member',
  inviteUrl = 'https://app.marketingpilot.ai/invite/accept?token=xxx',
  expiresInDays = 7,
}: InviteEmailProps) {
  return (
    <BaseLayout preview={`You've been invited to join ${organizationName} on Marketing Pilot AI`}>
      <Section style={content}>
        <Heading style={heading}>You&apos;ve Been Invited!</Heading>
        <Text style={paragraph}>
          <strong>{inviterName}</strong> has invited you to join{' '}
          <strong>{organizationName}</strong> on Marketing Pilot AI as a{' '}
          <strong>{role}</strong>.
        </Text>
        <Section style={inviteBox}>
          <Text style={inviteBoxText}>
            <strong>Organization:</strong> {organizationName}
          </Text>
          <Text style={inviteBoxText}>
            <strong>Your Role:</strong> {role}
          </Text>
        </Section>
        <Section style={buttonContainer}>
          <Button href={inviteUrl}>Accept Invitation</Button>
        </Section>
        <Text style={expiryText}>
          This invitation expires in {expiresInDays} days.
        </Text>
        <Text style={paragraph}>
          Marketing Pilot AI is an AI-powered marketing automation platform that
          helps teams create, schedule, and publish content across all their
          marketing channels.
        </Text>
        <Text style={smallText}>
          If you don&apos;t want to join this organization, you can ignore this
          email.
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default InviteEmail;

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

const inviteBox: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '24px 0',
};

const inviteBoxText: React.CSSProperties = {
  fontSize: '14px',
  color: '#1a1a1a',
  margin: '0 0 8px',
};

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
};

const expiryText: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  textAlign: 'center',
  margin: '0 0 24px',
};

const smallText: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '24px 0 0',
};
