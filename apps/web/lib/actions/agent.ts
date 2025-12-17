'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import {
  getOrCreateAgentState,
  recordTaskPerformance,
  processUserFeedback,
  getLearningContext,
  getAgentAnalysis,
  generateAgentInsights,
} from '@/lib/agent/learning-system';
import type {
  AgentType,
  AgentState,
  AgentAnalysis,
  LearningInsight,
  PerformanceMetrics,
  FeedbackInput,
} from '@/lib/agent/types';

export type ActionResult<T = void> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function getOrganizationId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  return membership?.organization_id || null;
}

/**
 * Get agent state for the current organization
 */
export async function getAgentState(
  agentName: AgentType
): Promise<ActionResult<AgentState>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const agentState = await getOrCreateAgentState(supabase, organizationId, agentName);
    return { success: true, data: agentState };
  } catch (error: any) {
    console.error('Error getting agent state:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all agent states for the organization
 */
export async function getAllAgentStates(): Promise<ActionResult<AgentState[]>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const { data, error } = await supabase
      .from('agent_state')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) {
      return { success: false, error: error.message };
    }

    // Initialize missing agents
    const agentTypes: AgentType[] = [
      'content_writer',
      'email_marketer',
      'social_manager',
      'seo_optimizer',
      'ad_manager',
      'analyst',
    ];

    const existingTypes = new Set(data?.map((a) => a.agent_name) || []);
    const missingAgents: AgentState[] = [];

    for (const agentType of agentTypes) {
      if (!existingTypes.has(agentType)) {
        const newAgent = await getOrCreateAgentState(supabase, organizationId, agentType);
        missingAgents.push(newAgent);
      }
    }

    return { success: true, data: [...(data || []), ...missingAgents] as AgentState[] };
  } catch (error: any) {
    console.error('Error getting all agent states:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get comprehensive agent analysis
 */
export async function getAgentAnalysisAction(
  agentName: AgentType
): Promise<ActionResult<AgentAnalysis>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const analysis = await getAgentAnalysis(supabase, organizationId, agentName);
    return { success: true, data: analysis };
  } catch (error: any) {
    console.error('Error getting agent analysis:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get learning insights for an agent
 */
export async function getAgentInsights(
  agentName: AgentType
): Promise<ActionResult<LearningInsight[]>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const insights = await generateAgentInsights(supabase, organizationId, agentName);
    return { success: true, data: insights };
  } catch (error: any) {
    console.error('Error getting agent insights:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Record task performance for learning
 */
export async function recordPerformance(
  agentName: AgentType,
  taskId: string,
  taskType: string,
  metrics: PerformanceMetrics,
  contentSummary?: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    await recordTaskPerformance(
      supabase,
      organizationId,
      agentName,
      taskId,
      taskType,
      metrics,
      contentSummary
    );

    revalidatePath('/dashboard/agents');
    return { success: true };
  } catch (error: any) {
    console.error('Error recording performance:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Submit feedback for agent learning
 */
export async function submitFeedback(
  agentName: AgentType,
  feedback: FeedbackInput
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    await processUserFeedback(supabase, organizationId, agentName, feedback);

    revalidatePath('/dashboard/agents');
    return { success: true };
  } catch (error: any) {
    console.error('Error submitting feedback:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get learning context for content generation
 */
export async function getContentContext(
  agentName: AgentType,
  taskType: string,
  productId?: string,
  audienceId?: string
): Promise<ActionResult<{ contextPrompt: string }>> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    const context = await getLearningContext(
      supabase,
      organizationId,
      agentName,
      taskType,
      productId,
      audienceId
    );

    return { success: true, data: { contextPrompt: context.contextPrompt } };
  } catch (error: any) {
    console.error('Error getting content context:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Reset agent state (for testing)
 */
export async function resetAgentState(agentName: AgentType): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const organizationId = await getOrganizationId();

    if (!organizationId) {
      return { success: false, error: 'No organization found' };
    }

    // Delete existing state
    await supabase
      .from('agent_state')
      .delete()
      .eq('organization_id', organizationId)
      .eq('agent_name', agentName);

    // Create fresh state
    await getOrCreateAgentState(supabase, organizationId, agentName);

    revalidatePath('/dashboard/agents');
    return { success: true };
  } catch (error: any) {
    console.error('Error resetting agent state:', error);
    return { success: false, error: error.message };
  }
}

// Note: getAgentDisplayName and getAgentDescription moved to @/lib/utils/agent-utils.ts
