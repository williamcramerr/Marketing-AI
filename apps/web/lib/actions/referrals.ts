'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { nanoid } from 'nanoid';

/**
 * Referral Program Server Actions
 */

// ============================================
// REFERRAL PROGRAMS
// ============================================

export async function getReferralPrograms() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: programs, error } = await supabase
    .from('referral_programs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return programs;
}

export async function getReferralProgram(id: string) {
  const supabase = await createClient();

  const { data: program, error } = await supabase
    .from('referral_programs')
    .select(`
      *,
      referral_links (
        id,
        code,
        click_count,
        signup_count,
        conversion_count,
        active,
        created_at
      )
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return program;
}

export async function createReferralProgram(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const name = formData.get('name') as string;
  const organizationId = formData.get('organization_id') as string;
  const description = formData.get('description') as string | null;

  const referrerRewardType = formData.get('referrer_reward_type') as string || 'credit';
  const referrerRewardAmount = parseInt(formData.get('referrer_reward_amount') as string) || 1000;
  const refereeRewardType = formData.get('referee_reward_type') as string || 'credit';
  const refereeRewardAmount = parseInt(formData.get('referee_reward_amount') as string) || 500;

  const qualificationRules = formData.get('qualification_rules')
    ? JSON.parse(formData.get('qualification_rules') as string)
    : { require_paid_subscription: true, minimum_subscription_days: 14 };

  const expiryDays = parseInt(formData.get('expiry_days') as string) || 90;

  const { data: program, error } = await supabase
    .from('referral_programs')
    .insert({
      organization_id: organizationId,
      name,
      description,
      referrer_reward_type: referrerRewardType,
      referrer_reward_amount: referrerRewardAmount,
      referee_reward_type: refereeRewardType,
      referee_reward_amount: refereeRewardAmount,
      qualification_rules: qualificationRules,
      expiry_days: expiryDays,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/referrals');
  return program;
}

export async function updateReferralProgram(id: string, formData: FormData) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};

  const name = formData.get('name');
  if (name) updates.name = name;

  const description = formData.get('description');
  if (description !== null) updates.description = description;

  const referrerRewardType = formData.get('referrer_reward_type');
  if (referrerRewardType) updates.referrer_reward_type = referrerRewardType;

  const referrerRewardAmount = formData.get('referrer_reward_amount');
  if (referrerRewardAmount) updates.referrer_reward_amount = parseInt(referrerRewardAmount as string);

  const refereeRewardType = formData.get('referee_reward_type');
  if (refereeRewardType) updates.referee_reward_type = refereeRewardType;

  const refereeRewardAmount = formData.get('referee_reward_amount');
  if (refereeRewardAmount) updates.referee_reward_amount = parseInt(refereeRewardAmount as string);

  const qualificationRules = formData.get('qualification_rules');
  if (qualificationRules) updates.qualification_rules = JSON.parse(qualificationRules as string);

  const expiryDays = formData.get('expiry_days');
  if (expiryDays) updates.expiry_days = parseInt(expiryDays as string);

  const active = formData.get('active');
  if (active !== null) updates.active = active === 'true';

  const { data: program, error } = await supabase
    .from('referral_programs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/referrals');
  revalidatePath(`/dashboard/growth/referrals/${id}`);
  return program;
}

export async function deleteReferralProgram(id: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('referral_programs')
    .delete()
    .eq('id', id);

  if (error) throw error;

  revalidatePath('/dashboard/growth/referrals');
}

// ============================================
// REFERRAL LINKS
// ============================================

export async function getMyReferralLinks() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: links, error } = await supabase
    .from('referral_links')
    .select(`
      *,
      referral_programs (id, name, referrer_reward_type, referrer_reward_amount)
    `)
    .eq('referrer_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return links;
}

export async function generateReferralLink(programId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Check if user already has a link for this program
  const { data: existingLink } = await supabase
    .from('referral_links')
    .select('*')
    .eq('program_id', programId)
    .eq('referrer_user_id', user.id)
    .single();

  if (existingLink) {
    return existingLink;
  }

  // Get program expiry
  const { data: program, error: programError } = await supabase
    .from('referral_programs')
    .select('expiry_days')
    .eq('id', programId)
    .single();

  if (programError) throw programError;

  // Generate unique code
  const code = nanoid(8).toUpperCase();

  // Calculate expiry date
  const expiresAt = program.expiry_days
    ? new Date(Date.now() + program.expiry_days * 24 * 60 * 60 * 1000)
    : null;

  const { data: link, error } = await supabase
    .from('referral_links')
    .insert({
      program_id: programId,
      referrer_user_id: user.id,
      code,
      expires_at: expiresAt?.toISOString() || null,
      active: true,
    })
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/referrals/my-referrals');
  return link;
}

export async function getReferralLinkByCode(code: string) {
  const supabase = await createClient();

  const { data: link, error } = await supabase
    .from('referral_links')
    .select(`
      *,
      referral_programs (
        id,
        name,
        organization_id,
        referee_reward_type,
        referee_reward_amount,
        active
      )
    `)
    .eq('code', code.toUpperCase())
    .eq('active', true)
    .single();

  if (error) throw error;
  return link;
}

export async function deactivateReferralLink(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: link, error } = await supabase
    .from('referral_links')
    .update({ active: false })
    .eq('id', id)
    .eq('referrer_user_id', user.id)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/referrals/my-referrals');
  return link;
}

// ============================================
// REFERRALS
// ============================================

export async function getMyReferrals() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  // Get referrals through user's links
  const { data: referrals, error } = await supabase
    .from('referrals')
    .select(`
      *,
      referral_links!inner (
        id,
        code,
        referrer_user_id,
        referral_programs (id, name)
      )
    `)
    .eq('referral_links.referrer_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return referrals;
}

export async function recordReferralClick(linkId: string, metadata?: Record<string, unknown>) {
  const supabase = await createClient();

  // Record the click
  await supabase.from('referral_link_clicks').insert({
    link_id: linkId,
    metadata: metadata || {},
  });

  // Increment click count
  await supabase.rpc('increment_referral_click', { link_id: linkId });
}

export async function createReferral(linkId: string, referredEmail: string, referredUserId?: string) {
  const supabase = await createClient();

  const { data: referral, error } = await supabase
    .from('referrals')
    .insert({
      link_id: linkId,
      referred_email: referredEmail.toLowerCase(),
      referred_user_id: referredUserId || null,
      status: referredUserId ? 'signed_up' : 'clicked',
      signed_up_at: referredUserId ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) throw error;

  // Update link counts
  if (referredUserId) {
    await supabase.rpc('increment_referral_signup', { link_id: linkId });
  }

  return referral;
}

export async function updateReferralStatus(
  id: string,
  status: 'clicked' | 'signed_up' | 'qualified' | 'converted' | 'rewarded'
) {
  const supabase = await createClient();

  const updates: Record<string, unknown> = { status };

  if (status === 'signed_up') {
    updates.signed_up_at = new Date().toISOString();
  } else if (status === 'qualified') {
    updates.qualified_at = new Date().toISOString();
  } else if (status === 'converted') {
    updates.converted_at = new Date().toISOString();
  }

  const { data: referral, error } = await supabase
    .from('referrals')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      referral_links (
        id,
        referrer_user_id,
        program_id,
        referral_programs (
          referrer_reward_type,
          referrer_reward_amount,
          referee_reward_type,
          referee_reward_amount
        )
      )
    `)
    .single();

  if (error) throw error;

  // If converted, increment conversion count
  if (status === 'converted') {
    await supabase.rpc('increment_referral_conversion', { link_id: referral.link_id });
  }

  revalidatePath('/dashboard/growth/referrals');
  return referral;
}

// ============================================
// REWARDS
// ============================================

export async function getMyRewards() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: rewards, error } = await supabase
    .from('referral_rewards')
    .select(`
      *,
      referrals (
        id,
        referred_email,
        status
      )
    `)
    .eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return rewards;
}

export async function createReward(referralId: string, recipientUserId: string, recipientType: 'referrer' | 'referee', rewardType: string, rewardAmount: number) {
  const supabase = await createClient();

  const { data: reward, error } = await supabase
    .from('referral_rewards')
    .insert({
      referral_id: referralId,
      recipient_user_id: recipientUserId,
      recipient_type: recipientType,
      reward_type: rewardType,
      reward_amount: rewardAmount,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;

  return reward;
}

export async function fulfillReward(rewardId: string, stripeCreditId?: string) {
  const supabase = await createClient();

  const { data: reward, error } = await supabase
    .from('referral_rewards')
    .update({
      status: 'fulfilled',
      fulfilled_at: new Date().toISOString(),
      stripe_credit_id: stripeCreditId || null,
    })
    .eq('id', rewardId)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/referrals');
  return reward;
}

export async function cancelReward(rewardId: string, reason?: string) {
  const supabase = await createClient();

  const { data: reward, error } = await supabase
    .from('referral_rewards')
    .update({
      status: 'cancelled',
      metadata: reason ? { cancellation_reason: reason } : {},
    })
    .eq('id', rewardId)
    .select()
    .single();

  if (error) throw error;

  revalidatePath('/dashboard/growth/referrals');
  return reward;
}

// ============================================
// CUSTOMER HAPPINESS (FOR AI PROMPTS)
// ============================================

export async function getCustomerHappinessSignals() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data: signals, error } = await supabase
    .from('customer_happiness_signals')
    .select('*')
    .order('happiness_score', { ascending: false });

  if (error) throw error;
  return signals;
}

export async function updateHappinessSignal(
  userId: string,
  organizationId: string,
  signals: {
    nps_score?: number;
    feature_adoption?: number;
    engagement_trend?: string;
    recent_wins?: string[];
  }
) {
  const supabase = await createClient();

  // Calculate happiness score from signals
  let happinessScore = 50; // Base score

  if (signals.nps_score !== undefined) {
    happinessScore += (signals.nps_score - 5) * 5; // NPS 0-10 maps to -25 to +25
  }
  if (signals.feature_adoption !== undefined) {
    happinessScore += (signals.feature_adoption / 100) * 20; // 0-100% maps to 0-20
  }
  if (signals.engagement_trend === 'increasing') {
    happinessScore += 10;
  } else if (signals.engagement_trend === 'decreasing') {
    happinessScore -= 10;
  }
  if (signals.recent_wins && signals.recent_wins.length > 0) {
    happinessScore += Math.min(signals.recent_wins.length * 5, 15);
  }

  happinessScore = Math.max(0, Math.min(100, happinessScore)); // Clamp to 0-100

  // Determine referral readiness
  let referralReadiness: string;
  if (happinessScore >= 80) {
    referralReadiness = 'ideal';
  } else if (happinessScore >= 65) {
    referralReadiness = 'ready';
  } else if (happinessScore >= 50) {
    referralReadiness = 'warming_up';
  } else {
    referralReadiness = 'not_ready';
  }

  // Determine recommended action
  let recommendedAction: string;
  if (referralReadiness === 'ideal') {
    recommendedAction = 'Send personalized referral invitation with premium reward';
  } else if (referralReadiness === 'ready') {
    recommendedAction = 'Include referral prompt in next engagement';
  } else if (referralReadiness === 'warming_up') {
    recommendedAction = 'Focus on increasing value delivery first';
  } else {
    recommendedAction = 'Address satisfaction issues before asking for referrals';
  }

  const { data: signal, error } = await supabase
    .from('customer_happiness_signals')
    .upsert({
      user_id: userId,
      organization_id: organizationId,
      happiness_score: happinessScore,
      signals,
      referral_readiness: referralReadiness,
      recommended_action: recommendedAction,
      last_calculated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return signal;
}

// ============================================
// ANALYTICS
// ============================================

export async function getReferralAnalytics(programId?: string, dateRange?: { start: Date; end: Date }) {
  const supabase = await createClient();

  let query = supabase
    .from('referral_metrics')
    .select('*')
    .order('date', { ascending: false });

  if (programId) {
    query = query.eq('program_id', programId);
  }

  if (dateRange) {
    query = query
      .gte('date', dateRange.start.toISOString().split('T')[0])
      .lte('date', dateRange.end.toISOString().split('T')[0]);
  } else {
    // Default to last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    query = query.gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
  }

  const { data: metrics, error } = await query;

  if (error) throw error;
  return metrics;
}

export async function getReferralSummary(programId?: string) {
  const supabase = await createClient();

  // Get referral counts by status
  let referralQuery = supabase.from('referrals').select('status');

  if (programId) {
    referralQuery = referralQuery.eq('referral_links.program_id', programId);
  }

  const { data: referrals, error: referralsError } = await referralQuery;

  if (referralsError) throw referralsError;

  const statusCounts: Record<string, number> = {};
  referrals?.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  // Get rewards summary
  let rewardsQuery = supabase
    .from('referral_rewards')
    .select('status, reward_amount');

  const { data: rewards, error: rewardsError } = await rewardsQuery;

  if (rewardsError) throw rewardsError;

  const totalRewardsPending = rewards
    ?.filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + r.reward_amount, 0) || 0;

  const totalRewardsFulfilled = rewards
    ?.filter(r => r.status === 'fulfilled')
    .reduce((sum, r) => sum + r.reward_amount, 0) || 0;

  // Get top referrers
  const { data: topReferrers, error: topReferrersError } = await supabase
    .from('referral_links')
    .select('referrer_user_id, conversion_count')
    .order('conversion_count', { ascending: false })
    .limit(10);

  if (topReferrersError) throw topReferrersError;

  return {
    statusCounts,
    totalReferrals: referrals?.length || 0,
    totalRewardsPending,
    totalRewardsFulfilled,
    topReferrers: topReferrers || [],
    conversionRate: referrals?.length
      ? ((statusCounts['converted'] || 0) / referrals.length) * 100
      : 0,
  };
}
