import { Button as EmailButton } from '@react-email/components';
import * as React from 'react';

interface ButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}

export function Button({ href, children, variant = 'primary' }: ButtonProps) {
  return (
    <EmailButton
      href={href}
      style={variant === 'primary' ? primaryButton : secondaryButton}
    >
      {children}
    </EmailButton>
  );
}

const baseButton: React.CSSProperties = {
  borderRadius: '6px',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'inline-block',
  padding: '12px 24px',
};

const primaryButton: React.CSSProperties = {
  ...baseButton,
  backgroundColor: '#0070f3',
  color: '#ffffff',
};

const secondaryButton: React.CSSProperties = {
  ...baseButton,
  backgroundColor: '#f6f9fc',
  color: '#0070f3',
  border: '1px solid #e6ebf1',
};
