import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StepIndicator } from '@/components/onboarding/step-indicator';
import { getOnboardingProgress } from '@/lib/actions/onboarding';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get onboarding progress
  const progressResult = await getOnboardingProgress();
  const progress = progressResult.data;

  // If onboarding is complete, redirect to dashboard
  if (progress?.completedAt) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">M</span>
            </div>
            <span className="text-lg font-semibold">Marketing Pilot AI</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {user.email}
          </div>
        </div>
      </header>

      {/* Progress indicator */}
      <div className="border-b bg-background">
        <div className="container mx-auto px-4 py-4">
          <StepIndicator
            currentStep={progress?.currentStep || 'welcome'}
            completedSteps={progress?.completedSteps || []}
            skippedSteps={progress?.skippedSteps || []}
          />
        </div>
      </div>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Need help? Contact us at support@marketingpilot.ai
        </div>
      </footer>
    </div>
  );
}
