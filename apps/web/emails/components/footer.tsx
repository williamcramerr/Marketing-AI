import { Hr, Link, Section, Text } from '@react-email/components';
import * as React from 'react';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <Section style={footer}>
      <Hr style={hr} />
      <Text style={footerText}>
        Marketing Pilot AI - AI-powered marketing automation
      </Text>
      <Text style={footerLinks}>
        <Link href="https://marketingpilot.ai" style={link}>
          Website
        </Link>
        {' | '}
        <Link href="https://marketingpilot.ai/docs" style={link}>
          Documentation
        </Link>
        {' | '}
        <Link href="https://marketingpilot.ai/support" style={link}>
          Support
        </Link>
      </Text>
      <Text style={copyright}>
        &copy; {currentYear} Marketing Pilot AI. All rights reserved.
      </Text>
    </Section>
  );
}

const footer: React.CSSProperties = {
  padding: '32px 48px',
};

const hr: React.CSSProperties = {
  borderColor: '#e6ebf1',
  margin: '0 0 24px',
};

const footerText: React.CSSProperties = {
  fontSize: '14px',
  color: '#8898aa',
  margin: '0 0 8px',
  textAlign: 'center',
};

const footerLinks: React.CSSProperties = {
  fontSize: '12px',
  color: '#8898aa',
  margin: '0 0 16px',
  textAlign: 'center',
};

const link: React.CSSProperties = {
  color: '#0070f3',
  textDecoration: 'none',
};

const copyright: React.CSSProperties = {
  fontSize: '12px',
  color: '#b4becc',
  margin: '0',
  textAlign: 'center',
};
