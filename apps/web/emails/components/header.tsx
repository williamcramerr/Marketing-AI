import { Img, Section, Text } from '@react-email/components';
import * as React from 'react';

export function Header() {
  return (
    <Section style={header}>
      <div style={logoContainer}>
        <div style={logoIcon}>M</div>
        <Text style={logoText}>Marketing Pilot AI</Text>
      </div>
    </Section>
  );
}

const header: React.CSSProperties = {
  padding: '32px 48px 24px',
  borderBottom: '1px solid #e6ebf1',
};

const logoContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
};

const logoIcon: React.CSSProperties = {
  width: '32px',
  height: '32px',
  backgroundColor: '#0070f3',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: '700',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  lineHeight: '32px',
};

const logoText: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0',
  display: 'inline-block',
  verticalAlign: 'middle',
  marginLeft: '8px',
};
