'use client';

import { cn } from '@/lib/utils';
import {
  type OnboardingStepId,
  getProgressSteps,
  calculateProgress,
} from '@/lib/onboarding/steps';
import { Progress } from '@/components/ui/progress';
import { Check, Circle } from 'lucide-react';

interface StepIndicatorProps {
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
}

export function StepIndicator({
  currentStep,
  completedSteps,
  skippedSteps,
}: StepIndicatorProps) {
  const steps = getProgressSteps();
  const progress = calculateProgress(completedSteps);

  const getStepStatus = (stepId: OnboardingStepId): 'completed' | 'current' | 'skipped' | 'upcoming' => {
    if (completedSteps.includes(stepId)) return 'completed';
    if (skippedSteps.includes(stepId)) return 'skipped';
    if (stepId === currentStep) return 'current';
    return 'upcoming';
  };

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <Progress value={progress} className="h-2 flex-1" />
        <span className="text-sm font-medium text-muted-foreground">
          {progress}% complete
        </span>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                    status === 'completed' && 'border-primary bg-primary text-primary-foreground',
                    status === 'current' && 'border-primary bg-background text-primary',
                    status === 'skipped' && 'border-muted-foreground/30 bg-muted text-muted-foreground',
                    status === 'upcoming' && 'border-muted-foreground/30 bg-background text-muted-foreground'
                  )}
                >
                  {status === 'completed' ? (
                    <Check className="h-5 w-5" />
                  ) : status === 'skipped' ? (
                    <span className="text-xs">Skip</span>
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                {/* Step label */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      'text-xs font-medium',
                      status === 'current' && 'text-primary',
                      status === 'completed' && 'text-foreground',
                      (status === 'upcoming' || status === 'skipped') && 'text-muted-foreground'
                    )}
                  >
                    {step.title}
                  </p>
                  {step.estimatedMinutes && status === 'current' && (
                    <p className="text-xs text-muted-foreground">
                      ~{step.estimatedMinutes} min
                    </p>
                  )}
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-12 flex-shrink-0 sm:w-16 md:w-24',
                    status === 'completed' ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
