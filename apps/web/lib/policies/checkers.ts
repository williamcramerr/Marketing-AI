import type {
  Policy,
  PolicyCheckResult,
  PolicyViolation,
  PolicyWarning,
  TaskForValidation,
  ValidationContext,
  RateLimitRule,
  BannedPhraseRule,
  RequiredPhraseRule,
  ClaimLockRule,
  DomainAllowlistRule,
  SuppressionRule,
  TimeWindowRule,
  BudgetLimitRule,
  ContentRule,
} from './types';

// Helper to create violation
function createViolation(
  policy: Policy,
  message: string,
  details?: Record<string, unknown>
): PolicyViolation {
  return {
    policyId: policy.id,
    policyName: policy.name,
    policyType: policy.type as any,
    severity: policy.severity,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
}

// Helper to create warning
function createWarning(
  policy: Policy,
  message: string,
  details?: Record<string, unknown>
): PolicyWarning {
  return {
    policyId: policy.id,
    policyName: policy.name,
    policyType: policy.type as any,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
}

// Helper to extract content from task
function getTaskContent(task: TaskForValidation, checkType: ValidationContext['checkType']): string {
  if (checkType === 'content' && task.draft_content) {
    return JSON.stringify(task.draft_content);
  }
  if (checkType === 'pre-execute' && task.final_content) {
    return JSON.stringify(task.final_content);
  }
  return '';
}

/**
 * Check rate limit policy
 */
export async function checkRateLimit(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as RateLimitRule;
  const { supabaseClient, organizationId } = context;

  // Determine time window
  const now = new Date();
  let startTime = new Date();
  switch (rule.window) {
    case 'hour':
      startTime.setHours(now.getHours() - 1);
      break;
    case 'day':
      startTime.setDate(now.getDate() - 1);
      break;
    case 'week':
      startTime.setDate(now.getDate() - 7);
      break;
    case 'month':
      startTime.setMonth(now.getMonth() - 1);
      break;
  }

  // Build query based on scope
  let query = supabaseClient
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startTime.toISOString());

  // Apply scope filters
  if (rule.scope === 'connector' && task.connector_id) {
    query = query.eq('connector_id', task.connector_id);
  } else if (rule.scope === 'campaign') {
    query = query.eq('campaign_id', task.campaign_id);
  }

  // Filter by task types if specified
  if (rule.taskTypes && rule.taskTypes.length > 0) {
    query = query.in('type', rule.taskTypes);
  }

  const { count, error } = await query;

  if (error) {
    console.error('Rate limit check error:', error);
    return { passed: true }; // Fail open on error
  }

  const currentCount = count || 0;
  const passed = currentCount < rule.limit;

  if (!passed) {
    const violation = createViolation(
      policy,
      `Rate limit exceeded: ${currentCount}/${rule.limit} tasks in the last ${rule.window}`,
      {
        currentCount,
        limit: rule.limit,
        window: rule.window,
        scope: rule.scope,
      }
    );
    return { passed: false, violation };
  }

  return { passed: true };
}

/**
 * Check for banned phrases
 */
export async function checkBannedPhrases(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as BannedPhraseRule;
  const content = getTaskContent(task, context.checkType);

  if (!content) {
    return { passed: true }; // No content to check
  }

  const foundPhrases: string[] = [];

  for (const phrase of rule.phrases) {
    let found = false;

    if (rule.regex) {
      // Use regex matching
      const flags = rule.caseSensitive ? 'g' : 'gi';
      const regex = new RegExp(phrase, flags);
      found = regex.test(content);
    } else {
      // Simple string matching
      const searchContent = rule.caseSensitive ? content : content.toLowerCase();
      const searchPhrase = rule.caseSensitive ? phrase : phrase.toLowerCase();

      if (rule.wholeWord) {
        const wordBoundaryRegex = new RegExp(`\\b${searchPhrase}\\b`, rule.caseSensitive ? 'g' : 'gi');
        found = wordBoundaryRegex.test(content);
      } else {
        found = searchContent.includes(searchPhrase);
      }
    }

    if (found) {
      foundPhrases.push(phrase);
    }
  }

  if (foundPhrases.length > 0) {
    const violation = createViolation(
      policy,
      `Content contains banned phrase(s): ${foundPhrases.join(', ')}`,
      { foundPhrases }
    );
    return { passed: false, violation };
  }

  return { passed: true };
}

/**
 * Check for required phrases
 */
export async function checkRequiredPhrases(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as RequiredPhraseRule;
  const content = getTaskContent(task, context.checkType);

  if (!content) {
    const violation = createViolation(policy, 'No content available to check for required phrases');
    return { passed: false, violation };
  }

  const foundPhrases: string[] = [];
  const missingPhrases: string[] = [];

  for (const phrase of rule.phrases) {
    const searchContent = rule.caseSensitive ? content : content.toLowerCase();
    const searchPhrase = rule.caseSensitive ? phrase : phrase.toLowerCase();

    // Apply location filtering if specified
    let locationContent = searchContent;
    if (rule.location === 'footer') {
      // Check last 20% of content
      const footerStart = Math.floor(searchContent.length * 0.8);
      locationContent = searchContent.slice(footerStart);
    } else if (rule.location === 'header') {
      // Check first 20% of content
      const headerEnd = Math.floor(searchContent.length * 0.2);
      locationContent = searchContent.slice(0, headerEnd);
    }

    if (locationContent.includes(searchPhrase)) {
      foundPhrases.push(phrase);
    } else {
      missingPhrases.push(phrase);
    }
  }

  // Check if requirement is met
  const passed = rule.atLeastOne ? foundPhrases.length > 0 : missingPhrases.length === 0;

  if (!passed) {
    const violation = createViolation(
      policy,
      rule.atLeastOne
        ? `Content must include at least one of: ${rule.phrases.join(', ')}`
        : `Content is missing required phrase(s): ${missingPhrases.join(', ')}`,
      { missingPhrases, requiredPhrases: rule.phrases, location: rule.location }
    );
    return { passed: false, violation };
  }

  return { passed: true };
}

/**
 * Check claim lock - verify only verified claims are used
 */
export async function checkClaimLock(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as ClaimLockRule;
  const content = getTaskContent(task, context.checkType);

  if (!content || !rule.requireVerified) {
    return { passed: true };
  }

  // Get product verified claims
  const { supabaseClient } = context;
  const { data: campaign } = await supabaseClient
    .from('campaigns')
    .select('product_id')
    .eq('id', task.campaign_id)
    .single();

  if (!campaign) {
    return { passed: true }; // Fail open if campaign not found
  }

  const { data: product } = await supabaseClient
    .from('products')
    .select('verified_claims')
    .eq('id', campaign.product_id)
    .single();

  if (!product || !product.verified_claims) {
    // No verified claims configured
    if (rule.requireVerified) {
      const violation = createViolation(
        policy,
        'No verified claims configured for this product',
        { productId: campaign.product_id }
      );
      return { passed: false, violation };
    }
    return { passed: true };
  }

  const verifiedClaims = product.verified_claims as { claims?: string[] };
  const allowedClaims = rule.allowedClaims || verifiedClaims.claims || [];

  // Check for blocked claims
  if (rule.blockedClaims && rule.blockedClaims.length > 0) {
    const foundBlocked: string[] = [];
    const contentLower = content.toLowerCase();

    for (const blockedClaim of rule.blockedClaims) {
      if (contentLower.includes(blockedClaim.toLowerCase())) {
        foundBlocked.push(blockedClaim);
      }
    }

    if (foundBlocked.length > 0) {
      const violation = createViolation(
        policy,
        `Content contains blocked claim(s): ${foundBlocked.join(', ')}`,
        { foundBlocked, blockedClaims: rule.blockedClaims }
      );
      return { passed: false, violation };
    }
  }

  // Provide warning if using unverified claims
  const warning = createWarning(
    policy,
    'Ensure all claims in content are verified and approved',
    { allowedClaims }
  );

  return { passed: true, warning };
}

/**
 * Check domain allowlist
 */
export async function checkDomainAllowlist(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as DomainAllowlistRule;
  const content = getTaskContent(task, context.checkType);

  if (!content) {
    return { passed: true };
  }

  // Extract URLs from content
  const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
  const urls = content.match(urlRegex) || [];
  const domains = urls.map((url) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return null;
    }
  }).filter(Boolean) as string[];

  const disallowedDomains = domains.filter(
    (domain) => !rule.allowedDomains.some((allowed) => domain.endsWith(allowed))
  );

  if (disallowedDomains.length > 0) {
    const violation = createViolation(
      policy,
      `Content contains links to disallowed domain(s): ${disallowedDomains.join(', ')}`,
      { disallowedDomains, allowedDomains: rule.allowedDomains }
    );
    return { passed: false, violation };
  }

  return { passed: true };
}

/**
 * Check email suppression list
 */
export async function checkSuppression(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as SuppressionRule;

  // Extract email addresses from task input data
  const emails: string[] = [];
  if (task.input_data?.to) {
    const toEmails = Array.isArray(task.input_data.to) ? task.input_data.to : [task.input_data.to];
    emails.push(...toEmails);
  }
  if (task.input_data?.recipients) {
    const recipients = Array.isArray(task.input_data.recipients)
      ? task.input_data.recipients
      : [task.input_data.recipients];
    emails.push(...recipients);
  }

  if (emails.length === 0) {
    return { passed: true }; // No emails to check
  }

  // This is a simplified check - in production, you would query a suppression list table
  // For now, we'll just log and pass
  const warning = createWarning(
    policy,
    `Email suppression check recommended for ${emails.length} recipient(s)`,
    { emails, suppressionListId: rule.suppressionListId }
  );

  return { passed: true, warning };
}

/**
 * Check time window policy
 */
export async function checkTimeWindow(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as TimeWindowRule;
  const scheduledTime = new Date(task.scheduled_for);

  // Convert to specified timezone (simplified - in production use proper timezone library)
  const day = scheduledTime.getDay();
  const hour = scheduledTime.getHours();

  // Check allowed days
  if (!rule.allowedDays.includes(day)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const violation = createViolation(
      policy,
      `Task scheduled for ${dayNames[day]}, which is not in allowed days`,
      {
        scheduledDay: day,
        allowedDays: rule.allowedDays,
        scheduledTime: task.scheduled_for,
      }
    );
    return { passed: false, violation };
  }

  // Check allowed hours
  if (hour < rule.allowedHours.start || hour >= rule.allowedHours.end) {
    const violation = createViolation(
      policy,
      `Task scheduled for hour ${hour}, outside allowed window ${rule.allowedHours.start}-${rule.allowedHours.end}`,
      {
        scheduledHour: hour,
        allowedHours: rule.allowedHours,
        scheduledTime: task.scheduled_for,
        timezone: rule.timezone,
      }
    );
    return { passed: false, violation };
  }

  return { passed: true };
}

/**
 * Check budget limit
 */
export async function checkBudgetLimit(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as BudgetLimitRule;
  const { supabaseClient } = context;

  // Determine time window
  const now = new Date();
  let startTime: Date | null = null;

  switch (rule.window) {
    case 'day':
      startTime = new Date();
      startTime.setDate(now.getDate() - 1);
      break;
    case 'week':
      startTime = new Date();
      startTime.setDate(now.getDate() - 7);
      break;
    case 'month':
      startTime = new Date();
      startTime.setMonth(now.getMonth() - 1);
      break;
    case 'campaign':
      // No time filter for campaign scope
      break;
    case 'lifetime':
      // No time filter for lifetime scope
      break;
  }

  // Get campaign for product scoping
  const { data: campaign } = await supabaseClient
    .from('campaigns')
    .select('product_id, budget_cents')
    .eq('id', task.campaign_id)
    .single();

  if (!campaign) {
    return { passed: true }; // Fail open
  }

  // Build query based on scope
  let query = supabaseClient
    .from('tasks')
    .select('execution_result')
    .eq('status', 'completed')
    .not('execution_result', 'is', null);

  if (rule.scope === 'campaign') {
    query = query.eq('campaign_id', task.campaign_id);
  } else if (rule.scope === 'product') {
    // Need to get all campaigns for this product
    const { data: productCampaigns } = await supabaseClient
      .from('campaigns')
      .select('id')
      .eq('product_id', campaign.product_id);

    if (productCampaigns && productCampaigns.length > 0) {
      const campaignIds = productCampaigns.map((c) => c.id);
      query = query.in('campaign_id', campaignIds);
    }
  }

  if (startTime) {
    query = query.gte('completed_at', startTime.toISOString());
  }

  const { data: tasks, error } = await query;

  if (error) {
    console.error('Budget limit check error:', error);
    return { passed: true }; // Fail open on error
  }

  // Calculate total spend from execution results
  let totalSpendCents = 0;
  if (tasks) {
    for (const task of tasks) {
      const result = task.execution_result as { costCents?: number } | null;
      if (result?.costCents) {
        totalSpendCents += result.costCents;
      }
    }
  }

  const passed = totalSpendCents < rule.maxSpendCents;

  if (!passed) {
    const violation = createViolation(
      policy,
      `Budget limit exceeded: $${(totalSpendCents / 100).toFixed(2)} / $${(rule.maxSpendCents / 100).toFixed(2)}`,
      {
        currentSpendCents: totalSpendCents,
        maxSpendCents: rule.maxSpendCents,
        window: rule.window,
        scope: rule.scope,
      }
    );
    return { passed: false, violation };
  }

  // Provide warning if approaching limit (>80%)
  if (totalSpendCents > rule.maxSpendCents * 0.8) {
    const warning = createWarning(
      policy,
      `Approaching budget limit: $${(totalSpendCents / 100).toFixed(2)} / $${(rule.maxSpendCents / 100).toFixed(2)}`,
      {
        currentSpendCents: totalSpendCents,
        maxSpendCents: rule.maxSpendCents,
        percentUsed: Math.round((totalSpendCents / rule.maxSpendCents) * 100),
      }
    );
    return { passed: true, warning };
  }

  return { passed: true };
}

/**
 * Check content rules
 */
export async function checkContentRule(
  policy: Policy,
  task: TaskForValidation,
  context: ValidationContext
): Promise<PolicyCheckResult> {
  const rule = policy.rule as ContentRule;
  const content = getTaskContent(task, context.checkType);

  if (!content) {
    return { passed: true }; // No content to check yet
  }

  const violations: string[] = [];

  // Check length constraints
  if (rule.maxLength && content.length > rule.maxLength) {
    violations.push(`Content exceeds maximum length: ${content.length} / ${rule.maxLength} characters`);
  }

  if (rule.minLength && content.length < rule.minLength) {
    violations.push(`Content below minimum length: ${content.length} / ${rule.minLength} characters`);
  }

  // Check required elements (simplified - would need structured content parsing in production)
  if (rule.requiredElements && rule.requiredElements.length > 0) {
    const missingElements = rule.requiredElements.filter((element) => !content.includes(element));
    if (missingElements.length > 0) {
      violations.push(`Missing required elements: ${missingElements.join(', ')}`);
    }
  }

  // Check forbidden elements
  if (rule.forbiddenElements && rule.forbiddenElements.length > 0) {
    const foundForbidden = rule.forbiddenElements.filter((element) => content.includes(element));
    if (foundForbidden.length > 0) {
      violations.push(`Contains forbidden elements: ${foundForbidden.join(', ')}`);
    }
  }

  if (violations.length > 0) {
    const violation = createViolation(policy, violations.join('; '), {
      violations,
      contentLength: content.length,
    });
    return { passed: false, violation };
  }

  return { passed: true };
}
