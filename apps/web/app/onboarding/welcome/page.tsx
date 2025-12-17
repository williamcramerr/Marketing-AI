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
import { advanceOnboardingStep } from '@/lib/actions/onboarding';
import { Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Sparkles,
    title: 'AI-Powered Content',
    description: 'Generate blog posts, emails, and social content with Claude AI',
  },
  {
    icon: Zap,
    title: 'Automated Workflows',
    description: 'Schedule and publish content across all your marketing channels',
  },
  {
    icon: Shield,
    title: 'Human-in-the-Loop',
    description: 'Review and approve all AI-generated content before it goes live',
  },
];

export default function WelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleContinue() {
    setIsLoading(true);
    try {
      const result = await advanceOnboardingStep('welcome');
      if (result.success && result.nextStep) {
        router.push(`/onboarding/${result.nextStep}`);
      }
    } catch (error) {
      console.error('Error advancing step:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-3xl">Welcome to Marketing Pilot AI</CardTitle>
        <CardDescription className="text-base mt-2">
          Your AI-powered marketing automation platform. Let&apos;s get you set up in just a few minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        <div className="grid gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={isLoading}
          className="min-w-[200px]"
        >
          {isLoading ? 'Loading...' : 'Get Started'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}
