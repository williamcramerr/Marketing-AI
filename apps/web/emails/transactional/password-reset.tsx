import { Heading, Text, Section, Code } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/base-layout';
import { Button } from '../components/button';

interface PasswordResetEmailProps {
  userName?: string;
  resetUrl?: string;
  expiresInMinutes?: number;
}

export function PasswordResetEmail({
  userName = 'there',
  resetUrl = 'https://app.marketingpilot.ai/reset-password?token=xxx',
  expiresInMinutes = 60,
}: PasswordResetEmailProps) {
  return (
    <BaseLayout preview="Reset your Marketing Pilot AI password">
      <Section style={content}>
        <Heading style={heading}>Reset Your Password</Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          We received a request to reset your password. Click the button below
          to choose a new password:
        </Text>
        <Section style={buttonContainer}>
          <Button href={resetUrl}>Reset Password</Button>
        </Section>
        <Text style={warningText}>
          This link will expire in {expiresInMinutes} minutes.
        </Text>
        <Text style={paragraph}>
          If you didn&apos;t request a password reset, you can safely ignore
          this email. Your password will remain unchanged.
        </Text>
        <Section style={divider} />
        <Text style={securityNote}>
          <strong>Security tip:</strong> Never share your password or reset link
          with anyone. Marketing Pilot AI will never ask for your password via
          email.
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default PasswordResetEmail;

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

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '32px 0',
};

const warningText: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  textAlign: 'center',
  margin: '0 0 24px',
};

const divider: React.CSSProperties = {
  borderTop: '1px solid #e6ebf1',
  margin: '24px 0',
};

const securityNote: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '20px',
  color: '#8898aa',
  backgroundColor: '#f6f9fc',
  padding: '12px 16px',
  borderRadius: '4px',
  margin: '0',
};
