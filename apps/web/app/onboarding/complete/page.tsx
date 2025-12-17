'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { completeOnboarding } from '@/lib/actions/onboarding';
import { CheckCircle2, ArrowRight, Sparkles, LayoutDashboard, FileText, Settings } from 'lucide-react';
import Link from 'next/link';

const nextSteps = [
  {
    icon: Sparkles,
    title: 'Generate Content',
    description: 'Use AI to create blog posts, emails, and social content',
    href: '/dashboard/tasks/new',
  },
  {
    icon: FileText,
    title: 'Manage Campaigns',
    description: 'View and manage your marketing campaigns',
    href: '/dashboard/campaigns',
  },
  {
    icon: Settings,
    title: 'Configure Settings',
    description: 'Set up approval workflows and team permissions',
    href: '/dashboard/settings',
  },
];

export default function CompletePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleComplete() {
    setIsLoading(true);
    try {
      const result = await completeOnboarding();
      if (result.success) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error completing onboarding:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <CardTitle className="text-3xl">You&apos;re All Set!</CardTitle>
        <CardDescription className="text-base mt-2">
          Congratulations! You&apos;ve completed the setup. Your marketing automation is ready to go.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="rounded-lg bg-muted/50 p-4">
          <h3 className="font-medium mb-3">What&apos;s Next?</h3>
          <div className="grid gap-3">
            {nextSteps.map((step) => (
              <Link
                key={step.title}
                href={step.href}
                className="flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <step.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Pro Tip</p>
              <p className="text-sm text-muted-foreground">
                Start by creating your first AI-generated content task. Marketing Pilot will
                analyze your product and audience to create tailored content.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={handleComplete}
          disabled={isLoading}
          className="min-w-[200px]"
        >
          {isLoading ? 'Loading...' : 'Go to Dashboard'}
          <LayoutDashboard className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
