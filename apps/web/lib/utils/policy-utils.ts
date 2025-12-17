import type { PolicyType, PolicySeverity } from '@/lib/policies/types';

export type { PolicyType, PolicySeverity };

/**
 * Get policy type display name
 */
export function getPolicyTypeDisplayName(type: PolicyType): string {
  const displayNames: Record<PolicyType, string> = {
    rate_limit: 'Rate Limit',
    banned_phrase: 'Banned Phrase',
    required_phrase: 'Required Phrase',
    claim_lock: 'Claim Lock',
    domain_allowlist: 'Domain Allowlist',
    suppression: 'Suppression List',
    time_window: 'Time Window',
    budget_limit: 'Budget Limit',
    content_rule: 'Content Rule',
  };
  return displayNames[type] || type;
}

/**
 * Get severity display info
 */
export function getSeverityDisplayInfo(severity: PolicySeverity): {
  label: string;
  color: string;
  bgColor: string;
} {
  const severityInfo: Record<PolicySeverity, { label: string; color: string; bgColor: string }> = {
    warn: { label: 'Warning', color: 'text-yellow-800', bgColor: 'bg-yellow-100' },
    block: { label: 'Block', color: 'text-red-800', bgColor: 'bg-red-100' },
    escalate: { label: 'Escalate', color: 'text-orange-800', bgColor: 'bg-orange-100' },
  };
  return severityInfo[severity] || { label: severity, color: 'text-gray-800', bgColor: 'bg-gray-100' };
}
