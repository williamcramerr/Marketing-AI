import type { AgentType } from '@/lib/agent/types';

export type { AgentType };

/**
 * Get agent display name
 */
export function getAgentDisplayName(agentName: AgentType): string {
  const names: Record<AgentType, string> = {
    content_writer: 'Content Writer',
    email_marketer: 'Email Marketer',
    social_manager: 'Social Media Manager',
    seo_optimizer: 'SEO Optimizer',
    ad_manager: 'Ad Campaign Manager',
    analyst: 'Marketing Analyst',
  };
  return names[agentName] || agentName;
}

/**
 * Get agent description
 */
export function getAgentDescription(agentName: AgentType): string {
  const descriptions: Record<AgentType, string> = {
    content_writer: 'Writes blog posts, landing pages, and marketing copy',
    email_marketer: 'Creates email campaigns, sequences, and newsletters',
    social_manager: 'Manages social media content across platforms',
    seo_optimizer: 'Optimizes content for search engines',
    ad_manager: 'Creates and manages ad campaigns',
    analyst: 'Analyzes marketing performance and provides insights',
  };
  return descriptions[agentName] || '';
}
