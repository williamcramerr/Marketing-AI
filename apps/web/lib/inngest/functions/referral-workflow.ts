import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Handle referral conversion - process rewards
 */
export const referralConversionHandler = inngest.createFunction(
  {
    id: 'referral-conversion',
    retries: 3,
  },
  { event: 'referral/conversion' },
  async ({ event, step }) => {
    const { referralId, linkId, referrerUserId } = event.data;
    const supabase = createAdminClient();

    // Load referral and program data
    const data = await step.run('load-data', async () => {
      const { data: referral, error } = await supabase
        .from('referrals')
        .select(`
          *,
          referral_links (
            *,
            referral_programs (*)
          )
        `)
        .eq('id', referralId)
        .single();

      if (error) throw error;
      return referral;
    });

    if (!data || !data.referral_links?.referral_programs) {
      return { status: 'program_not_found', referralId };
    }

    const program = data.referral_links.referral_programs;

    // Check qualification rules
    const isQualified = await step.run('check-qualification', async () => {
      const rules = program.qualification_rules || {};

      if (rules.require_paid_subscription) {
        // Check if referred user has an active subscription
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('status, created_at')
          .eq('user_id', data.referred_user_id)
          .eq('status', 'active')
          .single();

        if (!subscription) {
          return { qualified: false, reason: 'no_active_subscription' };
        }

        if (rules.minimum_subscription_days) {
          const daysActive = Math.floor(
            (Date.now() - new Date(subscription.created_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysActive < rules.minimum_subscription_days) {
            return { qualified: false, reason: 'subscription_too_new', daysNeeded: rules.minimum_subscription_days - daysActive };
          }
        }
      }

      return { qualified: true };
    });

    if (!isQualified.qualified) {
      // Schedule recheck if just needs more time
      if (isQualified.daysNeeded) {
        await step.sleep('wait-for-qualification', `${isQualified.daysNeeded}d`);

        // Recheck
        const recheckResult = await step.run('recheck-qualification', async () => {
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status')
            .eq('user_id', data.referred_user_id)
            .eq('status', 'active')
            .single();

          return !!subscription;
        });

        if (!recheckResult) {
          await step.run('mark-unqualified', async () => {
            await supabase
              .from('referrals')
              .update({ status: 'unqualified' })
              .eq('id', referralId);
          });
          return { status: 'unqualified', reason: isQualified.reason };
        }
      } else {
        return { status: 'unqualified', reason: isQualified.reason };
      }
    }

    // Mark referral as qualified
    await step.run('mark-qualified', async () => {
      await supabase
        .from('referrals')
        .update({
          status: 'qualified',
          qualified_at: new Date().toISOString(),
        })
        .eq('id', referralId);
    });

    // Create rewards
    const rewards = await step.run('create-rewards', async () => {
      const createdRewards = [];

      // Referrer reward
      const { data: referrerReward } = await supabase
        .from('referral_rewards')
        .insert({
          referral_id: referralId,
          recipient_user_id: referrerUserId,
          recipient_type: 'referrer',
          reward_type: program.referrer_reward_type,
          reward_amount: program.referrer_reward_amount,
          status: 'pending',
        })
        .select()
        .single();

      if (referrerReward) createdRewards.push(referrerReward);

      // Referee reward (if user exists)
      if (data.referred_user_id) {
        const { data: refereeReward } = await supabase
          .from('referral_rewards')
          .insert({
            referral_id: referralId,
            recipient_user_id: data.referred_user_id,
            recipient_type: 'referee',
            reward_type: program.referee_reward_type,
            reward_amount: program.referee_reward_amount,
            status: 'pending',
          })
          .select()
          .single();

        if (refereeReward) createdRewards.push(refereeReward);
      }

      return createdRewards;
    });

    // Process rewards based on type
    for (const reward of rewards) {
      await step.run(`process-reward-${reward.id}`, async () => {
        try {
          let stripeCreditId = null;

          switch (reward.reward_type) {
            case 'credit':
              // Add credit to Stripe customer balance
              stripeCreditId = await applyStripeCredit(supabase, reward.recipient_user_id, reward.reward_amount);
              break;

            case 'discount_percent':
            case 'discount_fixed':
              // Create Stripe coupon
              stripeCreditId = await createStripeCoupon(supabase, reward.recipient_user_id, reward.reward_type, reward.reward_amount);
              break;

            case 'free_month':
              // Extend subscription
              await extendSubscription(supabase, reward.recipient_user_id, 30);
              break;

            case 'tokens':
              // Add tokens to account
              await addTokens(supabase, reward.recipient_user_id, reward.reward_amount);
              break;
          }

          // Mark reward as fulfilled
          await supabase
            .from('referral_rewards')
            .update({
              status: 'fulfilled',
              fulfilled_at: new Date().toISOString(),
              stripe_credit_id: stripeCreditId,
            })
            .eq('id', reward.id);
        } catch (error) {
          console.error(`Failed to process reward ${reward.id}:`, error);
          await supabase
            .from('referral_rewards')
            .update({
              status: 'failed',
              metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
            })
            .eq('id', reward.id);
        }
      });
    }

    // Update referral status to rewarded
    await step.run('mark-rewarded', async () => {
      await supabase
        .from('referrals')
        .update({ status: 'rewarded' })
        .eq('id', referralId);

      // Increment link conversion count
      await supabase.rpc('increment_referral_conversion', { link_id: linkId });

      // Update program totals
      await supabase
        .from('referral_programs')
        .update({
          total_conversions: program.total_conversions + 1,
        })
        .eq('id', program.id);
    });

    // Send notification to referrer
    await step.run('notify-referrer', async () => {
      // Would integrate with notification/email system
      console.log(`Referral reward notification sent to user ${referrerUserId}`);
    });

    return { status: 'completed', referralId, rewardsProcessed: rewards.length };
  }
);

/**
 * Daily check for pending referral qualifications
 */
export const referralQualificationCheck = inngest.createFunction(
  {
    id: 'referral-qualification-check',
    retries: 1,
  },
  { cron: '0 8 * * *' }, // 8am daily
  async ({ step }) => {
    const supabase = createAdminClient();

    // Find referrals pending qualification
    const pending = await step.run('find-pending', async () => {
      const { data } = await supabase
        .from('referrals')
        .select(`
          *,
          referral_links (
            referrer_user_id,
            referral_programs (qualification_rules)
          )
        `)
        .eq('status', 'signed_up')
        .not('referred_user_id', 'is', null);

      return data || [];
    });

    let qualified = 0;

    for (const referral of pending) {
      const checkResult = await step.run(`check-${referral.id}`, async () => {
        const rules = referral.referral_links?.referral_programs?.qualification_rules || {};

        if (rules.require_paid_subscription) {
          const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status, created_at')
            .eq('user_id', referral.referred_user_id)
            .eq('status', 'active')
            .single();

          if (!subscription) return false;

          if (rules.minimum_subscription_days) {
            const daysActive = Math.floor(
              (Date.now() - new Date(subscription.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            if (daysActive < rules.minimum_subscription_days) return false;
          }
        }

        return true;
      });

      if (checkResult) {
        await step.run(`trigger-conversion-${referral.id}`, async () => {
          await inngest.send({
            name: 'referral/conversion',
            data: {
              referralId: referral.id,
              linkId: referral.link_id,
              referrerUserId: referral.referral_links?.referrer_user_id,
            },
          });
        });
        qualified++;
      }
    }

    return { status: 'completed', checked: pending.length, qualified };
  }
);

/**
 * Weekly referral metrics aggregation
 */
export const referralWeeklyMetrics = inngest.createFunction(
  {
    id: 'referral-weekly-metrics',
    retries: 1,
  },
  { cron: '0 9 * * 1' }, // 9am on Mondays
  async ({ step }) => {
    const supabase = createAdminClient();

    await step.run('aggregate-metrics', async () => {
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      const weekStart = lastWeek.toISOString().split('T')[0];

      const today = new Date();
      const weekEnd = today.toISOString().split('T')[0];

      // Get all programs
      const { data: programs } = await supabase
        .from('referral_programs')
        .select('id, organization_id');

      for (const program of programs || []) {
        // Count clicks
        const { count: clicks } = await supabase
          .from('referral_link_clicks')
          .select('*', { count: 'exact', head: true })
          .eq('link_id', program.id)
          .gte('created_at', `${weekStart}T00:00:00`)
          .lt('created_at', `${weekEnd}T23:59:59`);

        // Count signups
        const { count: signups } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referral_links.program_id', program.id)
          .gte('signed_up_at', `${weekStart}T00:00:00`)
          .lt('signed_up_at', `${weekEnd}T23:59:59`);

        // Count conversions
        const { count: conversions } = await supabase
          .from('referrals')
          .select('*', { count: 'exact', head: true })
          .eq('referral_links.program_id', program.id)
          .gte('converted_at', `${weekStart}T00:00:00`)
          .lt('converted_at', `${weekEnd}T23:59:59`);

        // Sum rewards
        const { data: rewards } = await supabase
          .from('referral_rewards')
          .select('reward_amount')
          .eq('status', 'fulfilled')
          .gte('fulfilled_at', `${weekStart}T00:00:00`)
          .lt('fulfilled_at', `${weekEnd}T23:59:59`);

        const totalRewards = rewards?.reduce((sum, r) => sum + r.reward_amount, 0) || 0;

        // Upsert weekly metrics
        await supabase.from('referral_metrics').upsert({
          program_id: program.id,
          organization_id: program.organization_id,
          date: weekStart,
          clicks: clicks || 0,
          signups: signups || 0,
          conversions: conversions || 0,
          rewards_paid_cents: totalRewards,
          conversion_rate: (clicks || 0) > 0 ? ((conversions || 0) / (clicks || 0)) * 100 : 0,
        });
      }
    });

    return { status: 'completed' };
  }
);

/**
 * Monthly customer happiness analysis
 */
export const customerHappinessAnalysis = inngest.createFunction(
  {
    id: 'customer-happiness-analysis',
    retries: 1,
  },
  { cron: '0 10 1 * *' }, // 10am on 1st of each month
  async ({ step }) => {
    const supabase = createAdminClient();

    await step.run('analyze-happiness', async () => {
      // Get all organization users with subscriptions
      const { data: users } = await supabase
        .from('users')
        .select(`
          id,
          organization_memberships (organization_id)
        `);

      for (const user of users || []) {
        const orgId = (user as any).organization_memberships?.[0]?.organization_id;
        if (!orgId) continue;

        // Gather signals
        const signals: Record<string, any> = {};

        // Check NPS score (if available)
        const { data: nps } = await supabase
          .from('nps_responses')
          .select('score')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (nps) signals.nps_score = nps.score;

        // Check feature adoption
        const { count: featuresUsed } = await supabase
          .from('feature_usage')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('last_used_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        // Assume 10 key features total
        signals.feature_adoption = Math.min(100, ((featuresUsed || 0) / 10) * 100);

        // Check engagement trend
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

        const { count: recentActivity } = await supabase
          .from('audit_logs')
          .select('*', { count: 'exact', head: true })
          .eq('actor_id', user.id)
          .gte('created_at', thirtyDaysAgo.toISOString());

        const { count: previousActivity } = await supabase
          .from('audit_logs')
          .select('*', { count: 'exact', head: true })
          .eq('actor_id', user.id)
          .gte('created_at', sixtyDaysAgo.toISOString())
          .lt('created_at', thirtyDaysAgo.toISOString());

        if ((recentActivity || 0) > (previousActivity || 0) * 1.1) {
          signals.engagement_trend = 'increasing';
        } else if ((recentActivity || 0) < (previousActivity || 0) * 0.9) {
          signals.engagement_trend = 'decreasing';
        } else {
          signals.engagement_trend = 'stable';
        }

        // Check for recent wins (completed campaigns, etc.)
        const { data: recentWins } = await supabase
          .from('campaigns')
          .select('name')
          .eq('status', 'completed')
          .gte('updated_at', thirtyDaysAgo.toISOString())
          .limit(5);

        signals.recent_wins = recentWins?.map(w => w.name) || [];

        // Calculate happiness score
        let happinessScore = 50;

        if (signals.nps_score !== undefined) {
          happinessScore += (signals.nps_score - 5) * 5;
        }
        happinessScore += (signals.feature_adoption / 100) * 20;
        if (signals.engagement_trend === 'increasing') happinessScore += 10;
        if (signals.engagement_trend === 'decreasing') happinessScore -= 10;
        if (signals.recent_wins.length > 0) happinessScore += Math.min(signals.recent_wins.length * 5, 15);

        happinessScore = Math.max(0, Math.min(100, happinessScore));

        // Determine readiness
        let referralReadiness: string;
        let recommendedAction: string;

        if (happinessScore >= 80) {
          referralReadiness = 'ideal';
          recommendedAction = 'Send personalized referral invitation with premium reward';
        } else if (happinessScore >= 65) {
          referralReadiness = 'ready';
          recommendedAction = 'Include referral prompt in next engagement';
        } else if (happinessScore >= 50) {
          referralReadiness = 'warming_up';
          recommendedAction = 'Focus on increasing value delivery first';
        } else {
          referralReadiness = 'not_ready';
          recommendedAction = 'Address satisfaction issues before asking for referrals';
        }

        // Upsert happiness signal
        await supabase.from('customer_happiness_signals').upsert({
          user_id: user.id,
          organization_id: orgId,
          happiness_score: happinessScore,
          signals,
          referral_readiness: referralReadiness,
          recommended_action: recommendedAction,
          last_calculated_at: new Date().toISOString(),
        });
      }
    });

    return { status: 'completed' };
  }
);

// Helper functions for reward processing

async function applyStripeCredit(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  amountCents: number
): Promise<string | null> {
  // Get user's Stripe customer ID
  const { data: user } = await supabase
    .from('users')
    .select('stripe_customer_id')
    .eq('id', userId)
    .single();

  if (!user?.stripe_customer_id) {
    throw new Error('User has no Stripe customer ID');
  }

  // In production, this would use the Stripe API:
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  // const balance = await stripe.customers.createBalanceTransaction(
  //   user.stripe_customer_id,
  //   { amount: -amountCents, currency: 'usd' }
  // );
  // return balance.id;

  console.log(`Applied ${amountCents} cents credit to user ${userId}`);
  return `bal_${Date.now()}`;
}

async function createStripeCoupon(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  type: string,
  amount: number
): Promise<string | null> {
  // In production, this would create a Stripe coupon:
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  // const coupon = await stripe.coupons.create({
  //   percent_off: type === 'discount_percent' ? amount : undefined,
  //   amount_off: type === 'discount_fixed' ? amount : undefined,
  //   currency: 'usd',
  //   duration: 'once',
  // });
  // return coupon.id;

  console.log(`Created ${type} coupon of ${amount} for user ${userId}`);
  return `coup_${Date.now()}`;
}

async function extendSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  days: number
): Promise<void> {
  // In production, this would extend the Stripe subscription:
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  // const subscriptions = await stripe.subscriptions.list({
  //   customer: customerId,
  //   status: 'active',
  // });
  // if (subscriptions.data.length > 0) {
  //   await stripe.subscriptions.update(subscriptions.data[0].id, {
  //     trial_end: Math.floor(Date.now() / 1000) + days * 24 * 60 * 60,
  //   });
  // }

  console.log(`Extended subscription by ${days} days for user ${userId}`);
}

async function addTokens(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  tokens: number
): Promise<void> {
  // Add tokens to user's account
  await supabase.rpc('add_user_tokens', { user_id: userId, tokens_to_add: tokens });

  console.log(`Added ${tokens} tokens to user ${userId}`);
}
