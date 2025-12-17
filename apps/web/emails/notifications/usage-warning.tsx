import { Heading, Text, Section, Link } from '@react-email/components';
import * as React from 'react';
import { BaseLayout } from '../components/base-layout';
import { Button } from '../components/button';

interface UsageWarningEmailProps {
  userName?: string;
  organizationName?: string;
  usagePercent?: number;
  tokensUsed?: number;
  tokensLimit?: number;
  billingUrl?: string;
  level?: 'warning' | 'critical';
}

export function UsageWarningEmail({
  userName = 'there',
  organizationName = 'Acme Inc',
  usagePercent = 80,
  tokensUsed = 400000,
  tokensLimit = 500000,
  billingUrl = 'https://app.marketingpilot.ai/dashboard/settings/billing',
  level = 'warning',
}: UsageWarningEmailProps) {
  const isCritical = level === 'critical';
  const tokensRemaining = tokensLimit - tokensUsed;

  return (
    <BaseLayout
      preview={
        isCritical
          ? `URGENT: ${organizationName} has reached AI usage limit`
          : `${organizationName} is approaching AI usage limit`
      }
    >
      <Section style={content}>
        <Section style={isCritical ? criticalBadge : warningBadge}>
          <Text style={badgeText}>
            {isCritical ? 'Limit Reached' : 'Usage Warning'}
          </Text>
        </Section>
        <Heading style={heading}>
          {isCritical
            ? 'AI Usage Limit Reached'
            : 'Approaching AI Usage Limit'}
        </Heading>
        <Text style={paragraph}>Hi {userName},</Text>
        <Text style={paragraph}>
          {isCritical
            ? `${organizationName} has reached its monthly AI token limit. New AI content generation is paused until the limit resets or you upgrade your plan.`
            : `${organizationName} has used ${usagePercent}% of its monthly AI token allowance. Consider upgrading to avoid interruptions.`}
        </Text>
        <Section style={usageBox}>
          <Section style={usageHeader}>
            <Text style={usageTitle}>AI Token Usage</Text>
            <Text style={usagePercentText}>{usagePercent}%</Text>
          </Section>
          <Section style={progressBarBg}>
            <Section
              style={{
                ...progressBarFill,
                width: `${Math.min(100, usagePercent)}%`,
                backgroundColor: isCritical ? '#dc3545' : '#ffc107',
              }}
            />
          </Section>
          <Section style={usageStats}>
            <Text style={usageStat}>
              <strong>{tokensUsed.toLocaleString()}</strong> tokens used
            </Text>
            <Text style={usageStat}>
              <strong>{tokensRemaining.toLocaleString()}</strong> remaining
            </Text>
          </Section>
        </Section>
        {isCritical ? (
          <Section style={alertBox}>
            <Text style={alertText}>
              <strong>What happens now?</strong>
              <br />
              AI content generation is paused. You can still view and manage
              existing content. Upgrade your plan to continue generating new
              content.
            </Text>
          </Section>
        ) : (
          <Text style={paragraph}>
            At current usage, you&apos;ll reach your limit soon. Upgrade to Pro
            or Enterprise for more AI tokens and additional features.
          </Text>
        )}
        <Section style={buttonContainer}>
          <Button href={billingUrl}>
            {isCritical ? 'Upgrade Now' : 'View Plans'}
          </Button>
        </Section>
        <Text style={smallText}>
          Usage resets on the 1st of each month. View detailed usage in your{' '}
          <Link href={billingUrl} style={linkStyle}>
            billing dashboard
          </Link>
          .
        </Text>
      </Section>
    </BaseLayout>
  );
}

export default UsageWarningEmail;

const content: React.CSSProperties = {
  padding: '24px 0',
};

const warningBadge: React.CSSProperties = {
  backgroundColor: '#fff3cd',
  borderRadius: '4px',
  padding: '8px 16px',
  display: 'inline-block',
  marginBottom: '16px',
};

const criticalBadge: React.CSSProperties = {
  backgroundColor: '#f8d7da',
  borderRadius: '4px',
  padding: '8px 16px',
  display: 'inline-block',
  marginBottom: '16px',
};

const badgeText: React.CSSProperties = {
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

const usageBox: React.CSSProperties = {
  backgroundColor: '#f6f9fc',
  borderRadius: '8px',
  padding: '20px',
  margin: '24px 0',
};

const usageHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '12px',
};

const usageTitle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0',
};

const usagePercentText: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: '600',
  color: '#1a1a1a',
  margin: '0',
};

const progressBarBg: React.CSSProperties = {
  backgroundColor: '#e6ebf1',
  borderRadius: '4px',
  height: '8px',
  overflow: 'hidden',
  marginBottom: '12px',
};

const progressBarFill: React.CSSProperties = {
  height: '100%',
  borderRadius: '4px',
};

const usageStats: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
};

const usageStat: React.CSSProperties = {
  fontSize: '12px',
  color: '#525f7f',
  margin: '0',
};

const alertBox: React.CSSProperties = {
  backgroundColor: '#f8d7da',
  borderRadius: '8px',
  padding: '16px',
  margin: '24px 0',
};

const alertText: React.CSSProperties = {
  fontSize: '14px',
  color: '#721c24',
  margin: '0',
  lineHeight: '22px',
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

const linkStyle: React.CSSProperties = {
  color: '#0070f3',
  textDecoration: 'none',
};
