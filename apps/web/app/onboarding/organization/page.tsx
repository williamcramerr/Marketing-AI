'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  advanceOnboardingStep,
  createOnboardingOrganization,
} from '@/lib/actions/onboarding';
import { Building2, ArrowRight } from 'lucide-react';

export default function OrganizationPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter an organization name');
      return;
    }

    setIsLoading(true);
    try {
      // Create organization
      const createResult = await createOnboardingOrganization(name.trim());

      if (!createResult.success) {
        setError(createResult.error || 'Failed to create organization');
        return;
      }

      // Advance to next step
      const advanceResult = await advanceOnboardingStep('organization', {
        organizationName: name.trim(),
        organizationId: createResult.data?.organizationId,
      });

      if (advanceResult.success && advanceResult.nextStep) {
        router.push(`/onboarding/${advanceResult.nextStep}`);
      } else {
        setError(advanceResult.error || 'Failed to advance to next step');
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Create Your Organization</CardTitle>
        <CardDescription className="text-base mt-2">
          Your organization is your workspace where you&apos;ll manage products, campaigns, and team members.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name</Label>
            <Input
              id="name"
              placeholder="e.g., Acme Marketing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              This is the name of your company or team.
            </p>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center pt-4">
          <Button
            type="submit"
            size="lg"
            disabled={isLoading}
            className="min-w-[200px]"
          >
            {isLoading ? 'Creating...' : 'Continue'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
