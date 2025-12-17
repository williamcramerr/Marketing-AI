/**
 * Onboarding Steps Configuration
 *
 * Defines the onboarding flow steps, their requirements, and metadata.
 */

export type OnboardingStepId =
  | 'welcome'
  | 'organization'
  | 'product'
  | 'connector'
  | 'campaign'
  | 'complete';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  path: string;
  required: boolean;
  skippable: boolean;
  order: number;
  estimatedMinutes?: number;
}

/**
 * Onboarding steps in order
 */
export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    description: 'Get started with Marketing Pilot AI',
    path: '/onboarding/welcome',
    required: true,
    skippable: false,
    order: 1,
    estimatedMinutes: 1,
  },
  {
    id: 'organization',
    title: 'Create Organization',
    description: 'Set up your organization profile',
    path: '/onboarding/organization',
    required: true,
    skippable: false,
    order: 2,
    estimatedMinutes: 2,
  },
  {
    id: 'product',
    title: 'Add Your First Product',
    description: 'Tell us about what you want to market',
    path: '/onboarding/product',
    required: true,
    skippable: false,
    order: 3,
    estimatedMinutes: 3,
  },
  {
    id: 'connector',
    title: 'Connect Your Tools',
    description: 'Connect your email, CMS, or social accounts',
    path: '/onboarding/connector',
    required: false,
    skippable: true,
    order: 4,
    estimatedMinutes: 2,
  },
  {
    id: 'campaign',
    title: 'Create First Campaign',
    description: 'Start your first marketing campaign',
    path: '/onboarding/campaign',
    required: false,
    skippable: true,
    order: 5,
    estimatedMinutes: 3,
  },
  {
    id: 'complete',
    title: 'All Set!',
    description: 'You are ready to use Marketing Pilot AI',
    path: '/onboarding/complete',
    required: true,
    skippable: false,
    order: 6,
    estimatedMinutes: 1,
  },
];

/**
 * Get step by ID
 */
export function getStep(stepId: OnboardingStepId): OnboardingStep | undefined {
  return ONBOARDING_STEPS.find((step) => step.id === stepId);
}

/**
 * Get the next step after a given step
 */
export function getNextStep(currentStepId: OnboardingStepId): OnboardingStep | null {
  const currentStep = getStep(currentStepId);
  if (!currentStep) return null;

  const nextStep = ONBOARDING_STEPS.find(
    (step) => step.order === currentStep.order + 1
  );

  return nextStep || null;
}

/**
 * Get the previous step before a given step
 */
export function getPreviousStep(currentStepId: OnboardingStepId): OnboardingStep | null {
  const currentStep = getStep(currentStepId);
  if (!currentStep) return null;

  const previousStep = ONBOARDING_STEPS.find(
    (step) => step.order === currentStep.order - 1
  );

  return previousStep || null;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(completedSteps: OnboardingStepId[]): number {
  // Count required steps for total
  const totalRequiredSteps = ONBOARDING_STEPS.filter(
    (step) => step.required && step.id !== 'complete'
  ).length;

  // Count completed required steps
  const completedRequiredSteps = completedSteps.filter((stepId) => {
    const step = getStep(stepId);
    return step?.required;
  }).length;

  return Math.round((completedRequiredSteps / totalRequiredSteps) * 100);
}

/**
 * Get estimated total time for onboarding
 */
export function getTotalEstimatedTime(): number {
  return ONBOARDING_STEPS.reduce(
    (total, step) => total + (step.estimatedMinutes || 0),
    0
  );
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(completedSteps: OnboardingStepId[]): boolean {
  const requiredSteps = ONBOARDING_STEPS.filter((step) => step.required);

  return requiredSteps.every(
    (step) =>
      completedSteps.includes(step.id) || step.id === 'complete'
  );
}

/**
 * Get steps that can be displayed in a progress indicator
 */
export function getProgressSteps(): OnboardingStep[] {
  // Exclude welcome and complete for progress display
  return ONBOARDING_STEPS.filter(
    (step) => step.id !== 'welcome' && step.id !== 'complete'
  );
}
